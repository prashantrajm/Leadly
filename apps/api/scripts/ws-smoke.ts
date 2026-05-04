// End-to-end smoke. Phase 7 + Phase 10 combined: drives the full widget
// handshake (visitor upsert → conversation create → token-authenticated
// WS upgrade) against a running wrangler dev (port 8787), sends a user
// message, and asserts the agent streams tokens back via the
// ConversationDO + OpenRouter.
//
// Run sequence:
//
//   1. (in another terminal) bun run --filter=api dev
//   2. bun run apps/api/scripts/ws-smoke.ts
//
// Exits 0 on success, non-zero with a clear message on failure.

import { getPrisma } from "../src/lib/prisma";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL not set — run via dotenv -e .dev.vars.");
	process.exit(1);
}
const HTTP = process.env.WS_SMOKE_HTTP ?? "http://127.0.0.1:8787";
const WS = process.env.WS_SMOKE_WS ?? "ws://127.0.0.1:8787";

const prisma = getPrisma(DATABASE_URL);
const tag = `smoke${Date.now().toString(36).slice(-6)}`;

async function main() {
	// 1. Confirm wrangler dev is up.
	const health = await fetch(`${HTTP}/health`).catch(() => null);
	if (!health || !health.ok) {
		console.error(`Could not reach ${HTTP}/health — is wrangler dev running?`);
		process.exit(1);
	}

	// 2. Seed fixtures.
	const userId = `${tag}-u`;
	await prisma.user.create({
		data: { id: userId, name: userId, email: `${userId}@test.local`, emailVerified: true },
	});
	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId, role: "owner" } },
		},
	});
	const agent = await prisma.agent.create({
		data: { organizationId: org.id, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	console.log(`[smoke] seeded org + agent (${agent.id})`);

	// 3. Drive the widget handshake exactly as a real iframe would.
	//    POST /api/widget/visitor — upsert + token
	const visitorRes = await fetch(
		`${HTTP}/api/widget/visitor?agentId=${agent.id}`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ externalId: `ext-${tag}`, userAgent: "smoke" }),
		},
	);
	if (!visitorRes.ok) {
		console.error("[smoke] /widget/visitor failed:", visitorRes.status, await visitorRes.text());
		process.exit(1);
	}
	const { token } = (await visitorRes.json()) as { visitorId: string; token: string };

	//    POST /api/widget/conversation — create conv + ws url
	const convRes = await fetch(`${HTTP}/api/widget/conversation`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({}),
	});
	if (!convRes.ok) {
		console.error("[smoke] /widget/conversation failed:", convRes.status, await convRes.text());
		process.exit(1);
	}
	const { conversationId } = (await convRes.json()) as {
		conversationId: string;
		wsUrl: string;
	};
	console.log(`[smoke] handshake done, conversationId=${conversationId}`);

	// 4. Open the WS and drive a turn. Token goes in the query string —
	//    browsers can't set headers on Upgrade.
	const url = `${WS}/api/conversations/${conversationId}/ws?token=${encodeURIComponent(token)}`;
	const ws = new WebSocket(url);
	const events: string[] = [];
	let done = false;
	let agentText = "";

	const timeout = setTimeout(() => {
		console.error("[smoke] timeout — no agent_turn_end received in 60s");
		console.error("[smoke] events so far:", events.slice(0, 20));
		ws.close();
		cleanup().finally(() => process.exit(1));
	}, 60_000);

	ws.addEventListener("open", () => {
		console.log("[smoke] WS open, sending widget_hello + user_msg");
		ws.send(JSON.stringify({ type: "widget_hello", visitorToken: "smoke" }));
		ws.send(
			JSON.stringify({
				type: "user_msg",
				text: "Hi! What's the answer to 2+2?",
			}),
		);
	});

	ws.addEventListener("message", (event) => {
		const msg = String(event.data);
		try {
			const frame = JSON.parse(msg);
			events.push(frame.type);
			if (frame.type === "agent_token") agentText += frame.delta;
			if (frame.type === "agent_turn_end") {
				console.log("[smoke] turn ended:", {
					finishReason: frame.finishReason,
					textPreview: frame.text.slice(0, 200),
				});
				done = true;
				clearTimeout(timeout);
				ws.close();
			}
			if (frame.type === "error") {
				console.error("[smoke] server error frame:", frame);
				clearTimeout(timeout);
				ws.close();
				cleanup().finally(() => process.exit(1));
			}
		} catch (err) {
			console.error("[smoke] non-JSON frame:", msg);
		}
	});

	ws.addEventListener("close", async () => {
		console.log("[smoke] WS closed");
		await cleanup();
		if (!done) {
			console.error(
				"[smoke] FAIL — WS closed before agent_turn_end. events:",
				events,
			);
			process.exit(1);
		}
		if (agentText.length === 0) {
			console.error(
				"[smoke] FAIL — no agent tokens received. events:",
				events,
			);
			process.exit(1);
		}
		console.log("[smoke] PASS — received", events.length, "frames");
		process.exit(0);
	});

	ws.addEventListener("error", (err) => {
		console.error("[smoke] WS error:", err);
	});

	async function cleanup() {
		await prisma.organization
			.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
			.catch(() => {});
		await prisma.user
			.deleteMany({ where: { id: { startsWith: tag } } })
			.catch(() => {});
	}
}

main().catch((err) => {
	console.error("[smoke] crashed:", err);
	process.exit(1);
});
