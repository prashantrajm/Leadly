import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/blog")({
	component: BlogPage,
});

const POSTS = [
	{
		date: "May 1, 2026",
		readTime: "6 min read",
		title: "Why we collapsed AI and human into one inbox",
		excerpt:
			"The 'transferring you to Sarah' moment was always the worst part of chat support. Here's the design call we made instead.",
	},
	{
		date: "April 18, 2026",
		readTime: "9 min read",
		title: "Retrieval beats stuffing: a back-of-the-envelope cost breakdown",
		excerpt:
			"At ~50 KB articles you save 20× on input tokens by retrieving instead of stuffing the whole knowledge base into context. The math, with receipts.",
	},
	{
		date: "April 5, 2026",
		readTime: "5 min read",
		title: "What 'BYOK' actually buys you",
		excerpt:
			"Bring-your-own-key isn't a billing trick — it's a control surface. A short defense of letting customers own the model relationship.",
	},
];

function BlogPage() {
	return (
		<PageShell
			eyebrow="Blog"
			title="Notes from the team."
			description="How we think about AI support, the design calls behind Leadly, and the occasional engineering deep-dive."
		>
			<div className="space-y-4">
				{POSTS.map((post) => (
					<a
						key={post.title}
						href="#"
						className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent-blue/30 md:p-8"
					>
						<div className="mb-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							<span>{post.date}</span>
							<span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
							<span>{post.readTime}</span>
						</div>
						<h3 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-accent-blue md:text-2xl">
							{post.title}
						</h3>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
							{post.excerpt}
						</p>
					</a>
				))}
			</div>
		</PageShell>
	);
}
