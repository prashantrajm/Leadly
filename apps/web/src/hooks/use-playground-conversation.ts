// usePlaygroundConversation — drives a real conversation against an agent
// from inside the dashboard, using the widget's public endpoints. The
// dashboard user is "impersonating" a visitor for testing purposes.
//
// Flow:
//   1. POST /api/widget/visitor?agentId=…       — get a visitor token
//   2. POST /api/widget/conversation            — get a conversationId + wsUrl
//        (Bearer = the visitor token from step 1)
//   3. open WebSocket, send widget_hello, exchange user_msg / agent_token frames
//
// We deliberately don't use api-client here because (a) startConversation
// doesn't accept a custom Bearer header, and (b) the playground's auth
// model is "session cookie + visitor JWT," not "session cookie alone."

import {
	parseServerFrame,
	type ServerFrame,
	type UserMsgFrame,
	type WidgetHelloFrame,
} from "@leadly/wire";
import { useCallback, useEffect, useRef, useState } from "react";

const RAW = import.meta.env.VITE_API_URL || "http://localhost:8787/api";
const API_BASE = RAW.replace(/\/api\/?$/, "");

export type PlaygroundTurn =
	| {
			id: string;
			role: "user";
			text: string;
			at: number;
		}
	| {
			id: string;
			role: "agent";
			text: string;
			finished: boolean;
			at: number;
		};

export type PlaygroundStatus =
	| "idle"
	| "connecting"
	| "open"
	| "closed"
	| "error";

export function usePlaygroundConversation(agentId: string) {
	const [status, setStatus] = useState<PlaygroundStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [turns, setTurns] = useState<PlaygroundTurn[]>([]);
	const [typing, setTyping] = useState(false);
	const [conversationId, setConversationId] = useState<string | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	// Track current streaming agent turn so token deltas append to the right row.
	const currentAgentTurnIdRef = useRef<string | null>(null);

	const open = useCallback(async () => {
		setStatus("connecting");
		setError(null);
		setTurns([]);
		setTyping(false);
		currentAgentTurnIdRef.current = null;

		try {
			// 1. Visitor (synthetic externalId — playground sessions don't dedupe).
			const externalId = `pg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const visitorRes = await fetch(
				`${API_BASE}/api/widget/visitor?agentId=${encodeURIComponent(agentId)}`,
				{
					method: "POST",
					credentials: "include",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						externalId,
						userAgent: "leadly-dashboard-playground",
					}),
				},
			);
			if (!visitorRes.ok) {
				throw new Error(`visitor ${visitorRes.status}: ${await visitorRes.text()}`);
			}
			const { token } = (await visitorRes.json()) as {
				visitorId: string;
				token: string;
			};

			// 2. Conversation (Bearer = visitor token, not the session cookie).
			const convRes = await fetch(`${API_BASE}/api/widget/conversation`, {
				method: "POST",
				credentials: "include",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({}),
			});
			if (!convRes.ok) {
				throw new Error(`conversation ${convRes.status}: ${await convRes.text()}`);
			}
			const { conversationId: convId, wsUrl } = (await convRes.json()) as {
				conversationId: string;
				wsUrl: string;
			};
			setConversationId(convId);

			// 3. WebSocket — visitor token rides in the URL since browsers can't
			// set headers on WS Upgrade.
			const u = new URL(wsUrl);
			u.searchParams.set("token", token);
			const ws = new WebSocket(u.toString());
			wsRef.current = ws;

			ws.onopen = () => {
				setStatus("open");
				const hello: WidgetHelloFrame = {
					type: "widget_hello",
					visitorToken: token,
				};
				ws.send(JSON.stringify(hello));
			};

			ws.onmessage = (e) => {
				let frame: ServerFrame;
				try {
					frame = parseServerFrame(JSON.parse(e.data as string));
				} catch (err) {
					console.warn("Unparseable server frame", err, e.data);
					return;
				}
				handleFrame(frame);
			};

			ws.onerror = () => {
				setError("WebSocket error");
				setStatus("error");
			};

			ws.onclose = () => {
				setStatus((s) => (s === "error" ? "error" : "closed"));
			};
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to start conversation");
			setStatus("error");
		}
	}, [agentId]);

	const close = useCallback(() => {
		wsRef.current?.close();
		wsRef.current = null;
		setStatus("closed");
		setConversationId(null);
	}, []);

	const sendMessage = useCallback((text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			setError("Connection isn't open. Click Reset to retry.");
			return;
		}

		// Optimistic local turn.
		setTurns((prev) => [
			...prev,
			{
				id: `local-${Date.now()}`,
				role: "user",
				text: trimmed,
				at: Date.now(),
			},
		]);

		const frame: UserMsgFrame = { type: "user_msg", text: trimmed };
		ws.send(JSON.stringify(frame));
	}, []);

	function handleFrame(frame: ServerFrame) {
		switch (frame.type) {
			case "typing":
				setTyping(frame.on);
				return;

			case "agent_token": {
				const turnId = frame.turnId;
				setTurns((prev) => {
					const existing = prev.findIndex(
						(t) => t.role === "agent" && t.id === turnId,
					);
					if (existing >= 0) {
						const next = [...prev];
						const cur = next[existing];
						if (cur.role === "agent") {
							next[existing] = {
								...cur,
								text: cur.text + frame.delta,
							};
						}
						return next;
					}
					currentAgentTurnIdRef.current = turnId;
					return [
						...prev,
						{
							id: turnId,
							role: "agent",
							text: frame.delta,
							finished: false,
							at: Date.now(),
						},
					];
				});
				return;
			}

			case "agent_turn_end": {
				const turnId = frame.turnId;
				setTurns((prev) => {
					const idx = prev.findIndex(
						(t) => t.role === "agent" && t.id === turnId,
					);
					if (idx >= 0) {
						const next = [...prev];
						const cur = next[idx];
						if (cur.role === "agent") {
							next[idx] = { ...cur, text: frame.text, finished: true };
						}
						return next;
					}
					// agent_token frames may have been missed (reconnect, etc.).
					// Use the final text as a single turn.
					return [
						...prev,
						{
							id: turnId,
							role: "agent",
							text: frame.text,
							finished: true,
							at: Date.now(),
						},
					];
				});
				setTyping(false);
				currentAgentTurnIdRef.current = null;
				return;
			}

			case "human_msg": {
				// In the playground, this only fires if someone takes over from
				// another tab — render it like an agent message.
				setTurns((prev) => [
					...prev,
					{
						id: frame.turnId,
						role: "agent",
						text: frame.text,
						finished: true,
						at: Date.now(),
					},
				]);
				return;
			}

			case "tool_call":
			case "tool_result":
			case "mode_change":
			case "pong":
				// Surfaceable in a debug pane later; ignore for the chat view.
				return;

			case "error":
				setError(`${frame.code}: ${frame.message}`);
				setStatus("error");
				return;
		}
	}

	useEffect(() => {
		return () => {
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, []);

	return {
		status,
		error,
		turns,
		typing,
		conversationId,
		open,
		close,
		sendMessage,
	};
}
