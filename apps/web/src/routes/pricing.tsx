import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

const TIERS = [
	{
		name: "Hobby",
		price: "$0",
		blurb: "For trying it out on a side project.",
		features: [
			"1 agent",
			"100 conversations / month",
			"Markdown knowledge base",
			"Community support",
		],
		cta: "Start free",
		highlighted: false,
	},
	{
		name: "Team",
		price: "$49",
		blurb: "For SMBs serious about support.",
		features: [
			"5 agents",
			"5,000 conversations / month",
			"Live human takeover inbox",
			"Lead capture & export",
			"Email support",
		],
		cta: "Start Team",
		highlighted: true,
	},
	{
		name: "Scale",
		price: "Talk to us",
		blurb: "For organizations with custom needs.",
		features: [
			"Unlimited agents",
			"Volume-priced conversations",
			"BYOK with full audit log",
			"Priority support & onboarding",
		],
		cta: "Contact sales",
		highlighted: false,
	},
];

function PricingPage() {
	return (
		<PageShell
			eyebrow="Pricing"
			title="Simple pricing. Predictable bills."
			description="Pay a flat monthly fee per seat. Bring your own LLM key and we don't take a cut of your tokens."
		>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{TIERS.map((tier) => (
					<div
						key={tier.name}
						className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
							tier.highlighted
								? "border-foreground/30 shadow-lg"
								: "border-border"
						}`}
					>
						<div className="mb-4">
							<div className="text-sm font-medium tracking-tight">
								{tier.name}
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tighter">
								{tier.price}
								{tier.price.startsWith("$") && tier.price !== "$0" && (
									<span className="ml-1 text-sm font-normal text-muted-foreground">
										/mo
									</span>
								)}
							</div>
							<p className="mt-2 text-sm text-muted-foreground">{tier.blurb}</p>
						</div>
						<ul className="my-6 flex-1 space-y-2.5 text-sm text-muted-foreground">
							{tier.features.map((f) => (
								<li key={f} className="flex items-start gap-2">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
									<span>{f}</span>
								</li>
							))}
						</ul>
						<Button
							asChild
							variant={tier.highlighted ? "default" : "outline"}
							className="w-full"
						>
							<Link to="/auth">
								{tier.cta}
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>
				))}
			</div>

			<p className="text-sm text-muted-foreground">
				All plans include the open-source codebase if you'd rather self-host.
				Usage above included quotas is billed at a transparent per-conversation
				rate, shown on your invoice.
			</p>
		</PageShell>
	);
}
