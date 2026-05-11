// ConversationDO — one Durable Object instance per conversation.
// Holds zero or more open WebSockets (the visitor's plus any dashboard
// observers), runs the agent loop on each user turn, and persists turns
// at boundaries.
//
// Hibernation: state.acceptWebSocket() lets Cloudflare evict the DO from
// memory between events (idle conversation = $0). Rehydration happens
// automatically on the next message; we stash the "what role is this WS"
// metadata via state.serializeAttachment so the rehydrated DO can route
// inbound frames without re-reading from Postgres.
//
// Tool execution sits inline with streamText via AI SDK's tool registry:
// the model emits a tool_call, the AI SDK invokes our registered execute()
// function, and we forward both call + result frames to all attached WS.

import { DurableObject } from "cloudflare:workers";
import {
	type ClientFrame,
	type ObserverFrame,
	type ServerFrame,
	parseInbound,
} from "@leadly/wire";
import type { ToolSet } from "ai";
import {
	assembleSystemPrompt,
	type ConversationMessage,
	makeOpenRouterModel,
	runTurn,
} from "../services/agent-loop";
import { retrieveForQuery } from "../lib/retrieval";
import { getPrisma } from "../lib/prisma";
import { resolveCredentialForAgent } from "../services/credential-resolver";
import { SYSTEM_TOOLS } from "../services/system-tools";
import type { Bindings } from "../types";

type WsRole = "visitor" | "observer";
type WsAttachment = { role: WsRole; conversationId: string };

// Idle alarms (design §4.2). 5-min reconnect grace + 30-min hard cap.
const RECONNECT_GRACE_MS = 5 * 60 * 1000;
const HARD_IDLE_CAP_MS = 30 * 60 * 1000;
type EndedBy = "visitor" | "operator" | "agent" | "system";
type EndResolution = "resolved" | "handed_off" | "abandoned" | "other";

export class ConversationDO extends DurableObject<Bindings> {
	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Internal control endpoint — mounted on the same DO so REST inbox
		// routes can broadcast to attached WebSockets without holding a WS
		// themselves. Requests come from the same Worker (no auth here; the
		// HTTP route in front already enforced membership), so we just
		// dispatch by url.pathname.
		if (url.pathname.endsWith("/control")) {
			return this.handleControl(request);
		}

		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("WebSocket upgrade required", { status: 426 });
		}

		const conversationId = url.searchParams.get("conversationId");
		if (!conversationId) {
			return new Response("conversationId required", { status: 400 });
		}
		const role: WsRole =
			url.searchParams.get("role") === "observer" ? "observer" : "visitor";

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Attaching the role survives DO hibernation — the rehydrated DO can
		// route this WS's frames without re-consulting Postgres.
		const attachment: WsAttachment = { role, conversationId };
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment(attachment);

		// Bump the idle alarm whenever someone connects — connections happen
		// after long pauses, and this prevents the 30-min cap from firing
		// mid-conversation.
		await this.bumpIdleAlarm();

		return new Response(null, { status: 101, webSocket: client });
	}

	// ---------- WS lifecycle (hibernation API) ----------

	override async webSocketMessage(
		ws: WebSocket,
		raw: ArrayBuffer | string,
	): Promise<void> {
		const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
		const attachment = ws.deserializeAttachment() as WsAttachment | null;
		if (!attachment) {
			send(ws, {
				type: "error",
				code: "internal",
				message: "WebSocket missing attachment",
			});
			return;
		}

		let frame: ClientFrame | ObserverFrame;
		try {
			frame = parseInbound(
				text,
				attachment.role === "observer" ? "observer" : "client",
			);
		} catch (err) {
			send(ws, {
				type: "error",
				code: "invalid_frame",
				message: (err as Error).message,
			});
			return;
		}

		await this.bumpIdleAlarm();

		if (attachment.role === "visitor") {
			await this.handleVisitorFrame(ws, attachment.conversationId, frame as ClientFrame);
		} else {
			await this.handleObserverFrame(ws, attachment.conversationId, frame as ObserverFrame);
		}
	}

	override async webSocketClose(
		_ws: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		// Don't end the conversation on close — visitors disconnect briefly
		// (page navigation, network blip) all the time. The 5-min grace alarm
		// is what eventually marks a stale conversation dead.
	}

	// ---------- internal control endpoint ----------

	// Inbox HTTP routes call POST /control with a JSON body describing the
	// action. This is the DO's only way to broadcast to attached WebSockets
	// from outside the WS itself (e.g. when an admin clicks "take over"
	// from the dashboard but the visitor's WS is hibernated).
	private async handleControl(request: Request): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}
		const body = (await request.json().catch(() => null)) as
			| { action: string; conversationId?: string; text?: string; note?: string }
			| null;
		if (!body || typeof body.action !== "string") {
			return new Response("Bad request", { status: 400 });
		}

		const prisma = getPrisma(this.env.DATABASE_URL);
		const conversationId = body.conversationId;
		if (!conversationId) {
			return new Response("conversationId required", { status: 400 });
		}
		await this.bumpIdleAlarm();

		switch (body.action) {
			case "take_over":
				await prisma.conversation.update({
					where: { id: conversationId },
					data: { mode: "paused", lastActivityAt: new Date() },
				});
				this.broadcast({ type: "mode_change", mode: "paused" });
				return Response.json({ ok: true });

			case "release": {
				const conversation = await prisma.conversation.findUnique({
					where: { id: conversationId },
					select: { mode: true, status: true },
				});
				if (!conversation) {
					return new Response("Conversation not found", { status: 404 });
				}
				if (conversation.status === "ended") {
					return new Response("Conversation already ended", { status: 409 });
				}
				await prisma.conversation.update({
					where: { id: conversationId },
					data: {
						mode: "auto",
						lastActivityAt: new Date(),
						...(conversation.mode === "paused" &&
						conversation.status === "abandoned"
							? { status: "active" as const, endedAt: null }
							: {}),
					},
				});
				this.broadcast({ type: "mode_change", mode: "auto" });
				return Response.json({ ok: true });
			}

			case "human_message": {
				const text = body.text;
				if (!text || text.length === 0 || text.length > 4000) {
					return new Response("Invalid text", { status: 400 });
				}
				const conversation = await prisma.conversation.findUnique({
					where: { id: conversationId },
					select: { mode: true, status: true },
				});
				if (!conversation) {
					return new Response("Conversation not found", { status: 404 });
				}
				if (conversation.status === "ended") {
					return new Response("Conversation already ended", { status: 409 });
				}
				const turn = await prisma.turn.create({
					data: { conversationId, role: "human", text },
				});
				await prisma.conversation.update({
					where: { id: conversationId },
					data: {
						lastActivityAt: new Date(),
						...(conversation.mode === "paused" &&
						conversation.status === "abandoned"
							? { status: "active" as const, endedAt: null }
							: {}),
					},
				});
				this.broadcast({ type: "human_msg", turnId: turn.id, text });
				return Response.json({ ok: true, turnId: turn.id });
			}

			case "end_conversation": {
				await this.endConversation(conversationId, {
					endedBy: "operator",
					resolution: "resolved",
					note: body.note,
				});
				return Response.json({ ok: true });
			}

			default:
				return new Response("Unknown action", { status: 400 });
		}
	}

	override async alarm(): Promise<void> {
		// On alarm fire we end the conversation. The bumpIdleAlarm logic
		// resets the alarm on every event, so this only triggers when nothing
		// has happened for ≥ HARD_IDLE_CAP_MS.
		const conversationId = await this.ctx.storage.get<string>("conversationId");
		if (!conversationId) return;
		const prisma = getPrisma(this.env.DATABASE_URL);
		const conversation = await prisma.conversation.findUnique({
			where: { id: conversationId },
			select: { mode: true, status: true },
		});
		if (!conversation || conversation.status !== "active") return;
		if (conversation.mode === "paused") {
			await this.bumpIdleAlarm();
			return;
		}
		await prisma.conversation
			.update({
				where: { id: conversationId },
				data: { status: "abandoned", endedAt: new Date() },
			})
			.catch(() => {});
	}

	// ---------- visitor frame dispatch ----------

	private async handleVisitorFrame(
		ws: WebSocket,
		conversationId: string,
		frame: ClientFrame,
	): Promise<void> {
		switch (frame.type) {
			case "ping":
				send(ws, { type: "pong" });
				return;
			case "widget_hello":
				// Token validation lives in the upgrade handler (Phase 10's
				// widgetTokenMiddleware). Reaching the DO already implies the
				// token was valid; we just acknowledge by setting up state.
				await this.ctx.storage.put("conversationId", conversationId);
				return;
			case "user_msg":
				await this.runUserTurn(ws, conversationId, frame.text);
				return;
			case "end_chat":
				await this.endConversation(conversationId, {
					endedBy: "visitor",
					resolution: "resolved",
				});
				return;
		}
	}

	private async handleObserverFrame(
		ws: WebSocket,
		conversationId: string,
		frame: ObserverFrame,
	): Promise<void> {
		const prisma = getPrisma(this.env.DATABASE_URL);

		switch (frame.type) {
			case "ping":
				send(ws, { type: "pong" });
				return;
			case "observer_hello":
				return;
			case "observer_take_over":
				await prisma.conversation.update({
					where: { id: conversationId },
					data: { mode: "paused" },
				});
				this.broadcast({ type: "mode_change", mode: "paused" });
				return;
			case "observer_release":
				await prisma.conversation.update({
					where: { id: conversationId },
					data: { mode: "auto" },
				});
				this.broadcast({ type: "mode_change", mode: "auto" });
				return;
			case "observer_human_msg": {
				// Persist as a Turn with role=human and broadcast as human_msg
				// so the visitor sees it as a normal agent reply (design §7.1).
				const turn = await prisma.turn.create({
					data: {
						conversationId,
						role: "human",
						text: frame.text,
					},
				});
				this.broadcast({
					type: "human_msg",
					turnId: turn.id,
					text: frame.text,
				});
				return;
			}
			case "observer_end_conversation":
				await this.endConversation(conversationId, {
					endedBy: "operator",
					resolution: "resolved",
					note: frame.note,
				});
				return;
		}
	}

	// ---------- the agent turn ----------

	private async runUserTurn(
		visitorWs: WebSocket,
		conversationId: string,
		userText: string,
	): Promise<void> {
		const prisma = getPrisma(this.env.DATABASE_URL);

		// Load the conversation + agent + visitor + history in one call. The
		// extension-accelerate include-type bug (#28703) bites here too, so
		// cast the result.
		type Loaded = {
			id: string;
			mode: "auto" | "paused";
			status: "active" | "ended" | "abandoned";
			agentId: string;
			organizationId: string;
			visitorId: string;
			leadId: string | null;
			agent: {
				id: string;
				name: string;
				greeting: string;
				systemPromptOverlay: string | null;
				fallbackMessage: string;
				defaultModel: string;
				identityPolicy:
					| "optional"
					| "required_before_chat"
					| "identified_only";
			};
			lead: { email: string | null; phone: string | null; name: string | null } | null;
			turns: Array<{ role: string; text: string }>;
		};
		const loaded = (await prisma.conversation.findUnique({
			where: { id: conversationId },
			include: {
				agent: {
					select: {
						id: true,
						name: true,
						greeting: true,
						systemPromptOverlay: true,
						fallbackMessage: true,
						defaultModel: true,
						identityPolicy: true,
					},
				},
				lead: { select: { email: true, phone: true, name: true } },
				turns: {
					orderBy: { createdAt: "asc" },
					select: { role: true, text: true },
				},
			},
		})) as unknown as Loaded | null;

		if (!loaded) {
			send(visitorWs, {
				type: "error",
				code: "internal",
				message: "Conversation not found",
			});
			return;
		}
		if (loaded.status !== "active") {
			send(visitorWs, {
				type: "conversation_ended",
				resolution: loaded.status === "abandoned" ? "abandoned" : "resolved",
				endedBy: "system",
				note: null,
			});
			return;
		}
		if (loaded.mode === "paused") {
			// While paused (a human is taking over), the agent is silent.
			// We still persist the user's message so observers see it.
			await prisma.turn.create({
				data: { conversationId, role: "user", text: userText },
			});
			return;
		}

		// 1. Persist the user turn first — even if the LLM call later fails,
		//    the inbox shows what the visitor said.
		await prisma.turn.create({
			data: { conversationId, role: "user", text: userText },
		});

		// 2. Retrieve top-k chunks. Soft-fail to empty array on retrieval
		//    error so the agent can still respond with the fallback message.
		let retrievedChunks: Awaited<ReturnType<typeof retrieveForQuery>> = [];
		try {
			retrievedChunks = await retrieveForQuery(
				this.env,
				loaded.agentId,
				userText,
				5,
			);
		} catch (err) {
			console.error("[do] retrieval failed", err);
		}

		// 3. Assemble system prompt from the agent's settings + retrieved
		//    context + identity state.
		const system = assembleSystemPrompt({
			agent: loaded.agent,
			retrievedChunks,
			identity: {
				hasEmail: Boolean(loaded.lead?.email),
				hasPhone: Boolean(loaded.lead?.phone),
				hasName: Boolean(loaded.lead?.name),
			},
		});

		// 4. Build the AI SDK ToolSet wired with execute() callbacks that
		//    do double duty: run the executor, broadcast tool_call /
		//    tool_result frames, and remember the result for AI SDK's
		//    multi-step tool flow.
		const ctx = {
			conversationId,
			agentId: loaded.agentId,
			organizationId: loaded.organizationId,
			visitorId: loaded.visitorId,
			prisma,
		};

		// Pre-allocate the agent turn id so we can stream tokens with a
		// stable identifier and reuse it on agent_turn_end.
		const turnId = newCuid();

		const tools: ToolSet = {
			capture_contact: {
				...SYSTEM_TOOLS.capture_contact.spec,
				execute: async (args, opts) => {
					this.broadcast({
						type: "tool_call",
						turnId,
						toolCallId: opts.toolCallId,
						name: "capture_contact",
						args,
					});
					const result = await SYSTEM_TOOLS.capture_contact.execute(
						ctx,
						args,
					);
					this.broadcast({
						type: "tool_result",
						turnId,
						toolCallId: opts.toolCallId,
						name: "capture_contact",
						result,
					});
					return result;
				},
			},
			request_handoff: {
				...SYSTEM_TOOLS.request_handoff.spec,
				execute: async (args, opts) => {
					this.broadcast({
						type: "tool_call",
						turnId,
						toolCallId: opts.toolCallId,
						name: "request_handoff",
						args,
					});
					const result = await SYSTEM_TOOLS.request_handoff.execute(
						ctx,
						args,
					);
					this.broadcast({
						type: "tool_result",
						turnId,
						toolCallId: opts.toolCallId,
						name: "request_handoff",
						result,
					});
					this.broadcast({ type: "mode_change", mode: "paused" });
					return result;
				},
			},
			end_conversation: {
				...SYSTEM_TOOLS.end_conversation.spec,
				execute: async (args, opts) => {
					this.broadcast({
						type: "tool_call",
						turnId,
						toolCallId: opts.toolCallId,
						name: "end_conversation",
						args,
					});
					const result = await SYSTEM_TOOLS.end_conversation.execute(
						ctx,
						args,
					);
					this.broadcast({
						type: "tool_result",
						turnId,
						toolCallId: opts.toolCallId,
						name: "end_conversation",
						result,
					});

					this.broadcast({
						type: "conversation_ended",
						resolution: args.resolution,
						endedBy: "agent",
						note: args.note ?? null,
					});
					await this.scheduleSummary(conversationId);
					return result;
				},
			},
			// set_conversation_summary is deliberately NOT exposed to the
			// LLM — design §4.3 says we call it deterministically after
			// end_conversation, not via the model.
		};

		// 5. Run the turn. Stream tokens to all attached WS as agent_token
		//    frames; on completion, persist the agent Turn row and emit
		//    agent_turn_end.
		this.broadcast({ type: "typing", on: true });
		const history: ConversationMessage[] = loaded.turns
			.filter((t) => t.role === "user" || t.role === "agent")
			.map((t) => ({
				role: t.role === "user" ? "user" : "assistant",
				content: t.text,
			}));

		const startedAt = Date.now();
		try {
			// Per-agent override → org default → platform key.
			const resolved = await resolveCredentialForAgent(
				this.env,
				loaded.agentId,
				loaded.organizationId,
			);
			const model = makeOpenRouterModel(
				resolved.apiKey,
				loaded.agent.defaultModel,
			);
			const result = await runTurn({
				model,
				system,
				history,
				userMessage: userText,
				tools,
				onToken: (delta) =>
					this.broadcast({ type: "agent_token", turnId, delta }),
			});
			this.broadcast({ type: "typing", on: false });
			this.broadcast({
				type: "agent_turn_end",
				turnId,
				text: result.text,
				finishReason: result.finishReason,
			});

			// Persist the finalized agent turn.
			await prisma.turn.create({
				data: {
					id: turnId,
					conversationId,
					role: "agent",
					text: result.text,
					llmProvider: "openrouter",
					model: loaded.agent.defaultModel,
					latencyMs: Date.now() - startedAt,
					tokensIn: result.tokensIn ?? null,
					tokensOut: result.tokensOut ?? null,
				},
			});

			// Bump the conversation's last-activity timestamp for inbox sort.
			await prisma.conversation.update({
				where: { id: conversationId },
				data: { lastActivityAt: new Date() },
			});
		} catch (err) {
			this.broadcast({ type: "typing", on: false });
			this.broadcast({
				type: "error",
				code: "internal",
				message: (err as Error).message,
			});
		}
	}

	// ---------- helpers ----------

	private broadcast(frame: ServerFrame): void {
		const sockets = this.ctx.getWebSockets();
		for (const ws of sockets) {
			try {
				ws.send(JSON.stringify(frame));
			} catch {
				// Closed sockets throw on send. Cloudflare cleans them up;
				// nothing for us to do here besides not crash the loop.
			}
		}
	}

	private async endConversation(
		conversationId: string,
		args: {
			endedBy: EndedBy;
			resolution: EndResolution;
			note?: string | null;
		},
	): Promise<void> {
		const prisma = getPrisma(this.env.DATABASE_URL);
		await prisma.conversation.update({
			where: { id: conversationId },
			data: {
				status: args.resolution === "abandoned" ? "abandoned" : "ended",
				endedAt: new Date(),
				lastActivityAt: new Date(),
			},
		});
		this.broadcast({
			type: "conversation_ended",
			resolution: args.resolution,
			endedBy: args.endedBy,
			note: args.note ?? null,
		});
		await this.scheduleSummary(conversationId);
	}

	private async scheduleSummary(conversationId: string): Promise<void> {
		try {
			await this.env.CONVERSATION_SUMMARIZE.create({
				params: { conversationId },
			});
		} catch (err) {
			console.error("[do] failed to schedule conversation summarize", err);
		}
	}

	private async bumpIdleAlarm(): Promise<void> {
		const next = Date.now() + HARD_IDLE_CAP_MS;
		await this.ctx.storage.setAlarm(next);
	}
}

// Local cuid generator — same approach as routes/kb.ts. Deterministic shape
// (22 base36 chars) for stable turn ids across the WS frames + DB row.
function newCuid(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) out += b.toString(36).padStart(2, "0");
	return out.slice(0, 22);
}

// Local send wrapper: the WS API's `send` takes a string; we centralize the
// JSON.stringify so the call sites stay clean.
function send(ws: WebSocket, frame: ServerFrame): void {
	ws.send(JSON.stringify(frame));
}

// Suppress "unused import" warning for RECONNECT_GRACE_MS — it's reserved
// for Phase 8's webSocketClose grace logic but we wire it now to keep the
// constant visible.
void RECONNECT_GRACE_MS;
