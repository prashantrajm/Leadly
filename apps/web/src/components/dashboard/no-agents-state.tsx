import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Empty state for org-wide pages when the org has no agents yet. The
// sidebar always shows every section, so each page explains what fills it.
export function NoAgentsState({ what }: { what: string }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center py-14 text-center">
				<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
					<Bot className="size-6" />
				</div>
				<h2 className="text-lg font-semibold tracking-tight">
					Create your first agent
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					{what} from every agent in this workspace show up here. Start by
					creating an agent and installing its widget.
				</p>
				<Button
					asChild
					className="mt-6 bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
				>
					<Link to="/dashboard/agents" search={{ new: true }}>
						Create agent
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
