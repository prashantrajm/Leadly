import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/guides")({
	component: GuidesPage,
});

const GUIDES = [
	{
		level: "Beginner",
		title: "From zero to your first conversation",
		blurb: "Sign up, write three KB articles, and watch a real visitor get an answer.",
		minutes: 12,
	},
	{
		level: "Beginner",
		title: "Writing a knowledge base your agent can actually use",
		blurb: "Article structure, heading hygiene, and the 5 mistakes that hurt retrieval quality.",
		minutes: 9,
	},
	{
		level: "Intermediate",
		title: "Designing the takeover handoff",
		blurb: "When to let the agent run, when to step in, and how to brief it back to autonomy.",
		minutes: 8,
	},
	{
		level: "Intermediate",
		title: "BYOK setup for OpenAI, Anthropic, and Google",
		blurb: "Where to get keys, how Leadly stores them, and the per-agent override pattern.",
		minutes: 7,
	},
	{
		level: "Advanced",
		title: "Self-hosting on a single VPS",
		blurb: "Docker compose, Postgres + pgvector, S3-compatible blob storage, and a checklist for going live.",
		minutes: 18,
	},
	{
		level: "Advanced",
		title: "Custom HTTP tools (preview)",
		blurb: "Wire your own endpoints to the agent so it can do work, not just answer questions.",
		minutes: 14,
	},
];

function GuidesPage() {
	return (
		<PageShell
			eyebrow="Guides"
			title="Hands-on walkthroughs."
			description="Short, opinionated guides — not reference docs. Each one ends with a thing actually shipped."
		>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{GUIDES.map((g) => (
					<a
						key={g.title}
						href="#"
						className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-border/80"
					>
						<div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							<span>{g.level}</span>
							<span>{g.minutes} min</span>
						</div>
						<h3 className="text-base font-semibold tracking-tight transition-colors group-hover:text-foreground md:text-lg">
							{g.title}
						</h3>
						<p className="mt-2 text-sm text-muted-foreground">{g.blurb}</p>
					</a>
				))}
			</div>
		</PageShell>
	);
}
