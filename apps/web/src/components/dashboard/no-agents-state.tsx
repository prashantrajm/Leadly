import { Link } from "@tanstack/react-router";
import { BotIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useOrgPath } from "@/hooks/use-current-org";

// Empty state for org-wide pages when the org has no agents yet. The
// sidebar always shows every section, so each page explains what fills it.
export function NoAgentsState({ what }: { what: string }) {
	const orgPath = useOrgPath();
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BotIcon />
				</EmptyMedia>
				<EmptyTitle>Create your first agent</EmptyTitle>
				<EmptyDescription>
					{what} from every agent in this workspace show up here. Start by
					creating an agent and installing its widget.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="accent" asChild>
					<Link to={orgPath("/agents")} search={{ new: true }}>
						Create agent
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
