import { createFileRoute } from "@tanstack/react-router";
import { GithubIcon, MessageIcon, TwitterIcon } from "@/components/icons";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/community")({
	component: CommunityPage,
});

const CHANNELS = [
	{
		icon: GithubIcon,
		title: "GitHub",
		blurb: "Issues, pull requests, and the source code itself.",
		cta: "Open repository",
		href: "https://github.com/prashantrajm/Leadly",
	},
	{
		icon: MessageIcon,
		title: "Discord",
		blurb: "Real-time chat for setup help, feature requests, and shipping wins.",
		cta: "Join the Discord",
		href: "#",
	},
	{
		icon: TwitterIcon,
		title: "X / Twitter",
		blurb: "Build-in-public updates and the occasional release video.",
		cta: "Follow @leadlyhq",
		href: "https://twitter.com",
	},
];

function CommunityPage() {
	return (
		<PageShell
			eyebrow="Community"
			title="Build it with us."
			description="Leadly is open source. The community is where we trade install tips, debug edge cases, and decide what ships next."
		>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{CHANNELS.map((c) => (
					<a
						key={c.title}
						href={c.href}
						target={c.href.startsWith("http") ? "_blank" : undefined}
						rel="noreferrer"
						className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent-blue/30"
					>
						<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-accent-blue/20 bg-accent-blue/5">
							<c.icon className="h-5 w-5 text-accent-blue" />
						</div>
						<h3 className="text-lg font-semibold tracking-tight">{c.title}</h3>
						<p className="mt-2 flex-1 text-sm text-muted-foreground">
							{c.blurb}
						</p>
						<span className="mt-5 text-sm font-medium text-accent-blue transition-opacity group-hover:opacity-80">
							{c.cta} →
						</span>
					</a>
				))}
			</div>

			<Section title="Code of conduct">
				<p>
					Be kind, give credit, and assume good faith. We follow a standard
					contributor covenant — read the full text in the repository.
				</p>
			</Section>
		</PageShell>
	);
}
