// The system tools as the live agent sees them: each executor wrapped so
// every call and result is broadcast to the conversation's sockets, with
// per-tool follow-ups (mode change, end + summary) supplied by the DO.

import type { ServerFrame } from "@leadly/wire";
import type { ToolSet } from "ai";
import {
	SYSTEM_TOOLS,
	type ToolExecCtx,
	type ToolExecResult,
} from "../services/system-tools";

// set_conversation_summary is deliberately absent: it runs deterministically
// after the conversation ends (design §4.3), never at the model's request.
const LIVE_TOOLS = [
	"capture_contact",
	"save_lead_details",
	"request_handoff",
	"end_conversation",
] as const;

type LiveToolName = (typeof LIVE_TOOLS)[number];
type ArgsOf<K extends LiveToolName> = Parameters<
	(typeof SYSTEM_TOOLS)[K]["execute"]
>[1];

export type LiveToolHooks = {
	[K in LiveToolName]?: (
		args: ArgsOf<K>,
		result: ToolExecResult,
	) => Promise<void> | void;
};

export function buildLiveTools(opts: {
	ctx: ToolExecCtx;
	broadcast: (frame: ServerFrame) => void;
	// The turn the call belongs to; changes as natural-messaging bubbles open.
	turnId: () => string;
	after?: LiveToolHooks;
}): ToolSet {
	const bind = <K extends LiveToolName>(name: K) => {
		const { spec, execute } = SYSTEM_TOOLS[name];
		const run = execute as (
			ctx: ToolExecCtx,
			args: ArgsOf<K>,
		) => Promise<ToolExecResult>;
		const after = opts.after?.[name] as LiveToolHooks[K];
		return {
			...spec,
			execute: async (
				args: ArgsOf<K>,
				{ toolCallId }: { toolCallId: string },
			) => {
				opts.broadcast({
					type: "tool_call",
					turnId: opts.turnId(),
					toolCallId,
					name,
					args,
				});
				const result = await run(opts.ctx, args);
				opts.broadcast({
					type: "tool_result",
					turnId: opts.turnId(),
					toolCallId,
					name,
					result,
				});
				await after?.(args, result);
				return result;
			},
		};
	};
	return Object.fromEntries(
		LIVE_TOOLS.map((name) => [name, bind(name)]),
	) as ToolSet;
}
