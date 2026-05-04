import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/changelog")({
	component: ChangelogPage,
});

const ENTRIES = [
	{
		date: "May 3, 2026",
		version: "v0.1.0",
		title: "Public preview",
		items: [
			"Embeddable chat widget — drop a script on any site.",
			"Markdown knowledge base with chunking and retrieval.",
			"Live human-takeover inbox.",
			"Bring your own model: OpenAI, Anthropic, Google, Mistral, Groq, local.",
		],
	},
	{
		date: "April 24, 2026",
		version: "v0.0.9",
		title: "Lead capture",
		items: [
			"Captures contact details inside the conversation.",
			"Lead deduplication per agent on email and phone.",
		],
	},
	{
		date: "April 10, 2026",
		version: "v0.0.5",
		title: "Knowledge base retrieval",
		items: [
			"pgvector-backed retrieval with citation back to source articles.",
			"Top-k=5 by default, tunable per agent.",
		],
	},
];

function ChangelogPage() {
	return (
		<PageShell
			eyebrow="Changelog"
			title="What we shipped."
			description="A reverse-chronological log of meaningful changes. Smaller fixes ship without an entry."
		>
			<div className="space-y-10">
				{ENTRIES.map((entry, i) => (
					<article
						key={entry.version}
						className="rounded-2xl border border-border bg-card p-6 md:p-8"
					>
						<div className="mb-4 flex flex-wrap items-baseline gap-3">
							<span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
								{entry.date}
							</span>
							<span
								className={
									i === 0
										? "rounded-full bg-accent-blue px-2 py-0.5 font-mono text-[11px] tracking-wider text-accent-blue-foreground"
										: "rounded-full border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[11px] tracking-wider text-foreground"
								}
							>
								{entry.version}
							</span>
							{i === 0 && (
								<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-blue">
									Latest
								</span>
							)}
						</div>
						<h3 className="text-lg font-semibold tracking-tight md:text-xl">
							{entry.title}
						</h3>
						<ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/40 md:text-base">
							{entry.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</article>
				))}
			</div>
		</PageShell>
	);
}
