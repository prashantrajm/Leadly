import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/about")({
	component: AboutPage,
});

function AboutPage() {
	return (
		<PageShell
			eyebrow="About"
			title="A small team building AI support that doesn't feel like a chatbot."
			description="We started Leadly because every chat widget we tried fell into the same trap: the AI either pretended too hard to be human and got caught, or punted to a human in a way that broke the conversation. We built one that does neither."
		>
			<Section title="What we believe">
				<p>
					Good support is a single, continuous conversation. Whether the next
					message is from a model or a teammate shouldn't matter to the
					visitor. It should feel like talking to one company that knows what
					it's doing.
				</p>
				<p>
					We also believe customers should own their data, their model
					relationship, and — if they want it — the source code that powers
					the product. That's why Leadly is open source and supports
					bring-your-own-key from day one.
				</p>
			</Section>

			<Section title="How we build">
				<p>
					Small team, opinionated defaults, weekly releases. We don't ship a
					feature until we've used it ourselves on a live site for a week. The
					changelog is honest — if something broke, we say what broke and what
					we did about it.
				</p>
			</Section>

			<Section title="Where we are">
				<p>
					Distributed. The team works across time zones with deep work hours
					protected and a shared design language for written async
					communication. If that sounds like your kind of team, the careers
					page is one click away.
				</p>
			</Section>
		</PageShell>
	);
}
