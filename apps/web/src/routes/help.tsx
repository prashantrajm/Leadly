import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell, Section } from "@/components/page-shell";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
	component: HelpPage,
});

const TOPICS = [
	{
		q: "My widget isn't appearing on my site",
		a: "Check that the script tag is in the <head> (not <body>), that data-agent-id matches the agent in your dashboard, and that your CSP allows the Leadly CDN. The dashboard's Install tab has a live test page if you want to confirm the agent itself works.",
	},
	{
		q: "The agent is answering questions wrong",
		a: "Almost always a knowledge-base issue. Open the agent's KB, search for the topic, and check whether an article actually covers it. Article titles and ## headings drive retrieval — make sure they read like questions a visitor would ask.",
	},
	{
		q: "How do I take over a conversation?",
		a: "Open the conversation in your inbox and click 'Take over'. The agent pauses, your replies render under the agent's name and avatar, and the visitor sees one continuous conversation. Click 'Release' to hand it back.",
	},
	{
		q: "Where do I add my OpenAI / Anthropic key?",
		a: "Settings → API keys at the org level. Per-agent overrides live on the agent's Settings → Model tab. Keys are encrypted at rest with AES-256-GCM.",
	},
	{
		q: "Can I delete a conversation?",
		a: "Yes — open the conversation, click the menu, and choose Delete. This removes the conversation, all turns, and any captured lead data linked exclusively to that conversation. The action is immediate.",
	},
	{
		q: "Billing question",
		a: "See the Refund Policy for refund eligibility, or email billing@leadly.app from the email associated with your account.",
	},
];

function HelpPage() {
	return (
		<PageShell
			eyebrow="Help Center"
			title="How can we help?"
			description="The questions support gets most often, with the answers."
		>
			<div className="rounded-2xl border border-border bg-card px-6 md:px-8">
				<Accordion type="single" collapsible className="w-full">
					{TOPICS.map((t, i) => (
						<AccordionItem
							key={t.q}
							value={`help-${i}`}
							className="border-border/60"
						>
							<AccordionTrigger className="py-5 text-left text-base font-medium tracking-tight hover:no-underline">
								{t.q}
							</AccordionTrigger>
							<AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
								{t.a}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>

			<Section title="Still stuck?">
				<p>
					If your answer isn't here, the fastest path is the community Discord
					— most setup questions get answered within an hour. For
					account-specific issues, contact us directly.
				</p>
				<div className="pt-3">
					<Link
						to="/contact-us"
						className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
					>
						Contact support
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</Section>
		</PageShell>
	);
}
