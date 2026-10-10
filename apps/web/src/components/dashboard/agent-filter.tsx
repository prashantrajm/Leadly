import type { Agent } from "@leadly/api-client";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

// "All agents / one agent" picker for the org-wide pages. Hidden when the
// org has a single agent — there's nothing to filter.
export function AgentFilter({
	agents,
	value,
	onChange,
}: {
	agents: Agent[];
	value: string | undefined;
	onChange: (agentId: string | undefined) => void;
}) {
	if (agents.length <= 1) return null;

	return (
		<Select
			value={value ?? ALL}
			onValueChange={(v) => onChange(v === ALL ? undefined : v)}
		>
			<SelectTrigger size="sm" className="w-44">
				<SelectValue placeholder="All agents" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL}>All agents</SelectItem>
				{agents.map((a) => (
					<SelectItem key={a.id} value={a.id}>
						{a.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// Shared search-param shape for pages that take an optional agent filter.
export type AgentSearch = { agent?: string };

export function validateAgentSearch(
	search: Record<string, unknown>,
): AgentSearch {
	return typeof search.agent === "string" && search.agent.length > 0
		? { agent: search.agent }
		: {};
}
