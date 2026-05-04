import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/careers")({
	component: CareersPage,
});

const ROLES = [
	{
		title: "Founding Product Engineer",
		location: "Remote · Full-time",
		blurb:
			"Own a slice of the platform end-to-end — backend, dashboard, widget. You'll ship features that thousands of conversations run through.",
	},
	{
		title: "Founding Designer",
		location: "Remote · Full-time",
		blurb:
			"Set the design language for the dashboard, the widget, and the marketing surface. Equal parts product and brand.",
	},
	{
		title: "Customer Engineer",
		location: "Remote · Full-time",
		blurb:
			"First line of contact with customers — debug installs, write the help articles support questions become, and feed the team what's painful.",
	},
];

function CareersPage() {
	return (
		<PageShell
			eyebrow="Careers"
			title="Build something visitors actually want to talk to."
			description="A small team, weekly releases, and customers who tell us when we're wrong. If that sounds like your shape, we'd love to talk."
		>
			<Section title="How we work">
				<p>
					Distributed-first, async-default. Deep work over standups. Honest
					feedback over politeness. Ship under your own name — the changelog
					credits the person, not the team.
				</p>
			</Section>

			<div className="space-y-3">
				{ROLES.map((r) => (
					<a
						key={r.title}
						href="#"
						className="group flex items-center justify-between rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent-blue/30"
					>
						<div className="min-w-0">
							<h3 className="text-base font-semibold tracking-tight md:text-lg">
								{r.title}
							</h3>
							<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
								{r.location}
							</div>
							<p className="mt-3 max-w-2xl text-sm text-muted-foreground">
								{r.blurb}
							</p>
						</div>
						<ArrowRight className="ml-4 h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
					</a>
				))}
			</div>

			<Section title="Don't see your role?">
				<p>
					Send us a note anyway. If we like the way you think, we'll figure
					out where you fit.
				</p>
			</Section>
		</PageShell>
	);
}
