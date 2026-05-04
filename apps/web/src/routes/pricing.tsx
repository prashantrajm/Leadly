import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

type Cycle = "monthly" | "yearly";

type Tier = {
	id: string;
	name: string;
	pitch: string;
	monthly: number | null; // null = "Custom" (Enterprise)
	highlighted?: boolean;
	cta: { label: string; href: string };
	limits: { label: string; value: string }[];
	features: { label: string; premium?: boolean }[];
};

const TIERS: Tier[] = [
	{
		id: "starter",
		name: "Starter",
		pitch: "For trying Leadly on a side project or your first site.",
		monthly: 0,
		cta: { label: "Start free", href: "/auth" },
		limits: [
			{ label: "Agents", value: "1" },
			{ label: "Conversations / mo", value: "200" },
			{ label: "KB articles", value: "25" },
			{ label: "Team seats", value: "1" },
		],
		features: [
			{ label: "Embeddable chat widget" },
			{ label: "Markdown knowledge base" },
			{ label: "Retrieval with citations" },
			{ label: "Lead capture in conversation" },
			{ label: "Basic analytics" },
			{ label: "Community support" },
		],
	},
	{
		id: "growth",
		name: "Growth",
		pitch: "For SMBs running real customer support.",
		monthly: 49,
		highlighted: true,
		cta: { label: "Start free", href: "/auth" },
		limits: [
			{ label: "Agents", value: "5" },
			{ label: "Conversations / mo", value: "5,000" },
			{ label: "KB articles", value: "500" },
			{ label: "Team seats", value: "5" },
		],
		features: [
			{ label: "Everything in Starter" },
			{ label: "Live human takeover inbox", premium: true },
			{ label: "Lead export (CSV)", premium: true },
			{ label: "Custom system prompt per agent", premium: true },
			{ label: "Tag and triage conversations" },
			{ label: "Email support" },
		],
	},
	{
		id: "scale",
		name: "Scale",
		pitch: "For teams with real volume and multiple brands.",
		monthly: 199,
		cta: { label: "Start free", href: "/auth" },
		limits: [
			{ label: "Agents", value: "25" },
			{ label: "Conversations / mo", value: "50,000" },
			{ label: "KB articles", value: "5,000" },
			{ label: "Team seats", value: "20" },
		],
		features: [
			{ label: "Everything in Growth" },
			{ label: "Custom domains for the widget", premium: true },
			{ label: "Audit log", premium: true },
			{ label: "Webhooks", premium: true },
			{ label: "Multi-org workspaces" },
			{ label: "Priority support" },
		],
	},
	{
		id: "enterprise",
		name: "Enterprise",
		pitch: "For organizations with custom needs and procurement.",
		monthly: null,
		cta: { label: "Contact sales", href: "/contact-us" },
		limits: [
			{ label: "Agents", value: "Unlimited" },
			{ label: "Conversations / mo", value: "Custom" },
			{ label: "KB articles", value: "Unlimited" },
			{ label: "Team seats", value: "Unlimited" },
		],
		features: [
			{ label: "Everything in Scale" },
			{ label: "SSO / SAML", premium: true },
			{ label: "SOC 2 documentation", premium: true },
			{ label: "DPA & custom MSA", premium: true },
			{ label: "Volume-priced conversations", premium: true },
			{ label: "Dedicated onboarding" },
		],
	},
];

const ADDONS = [
	{
		title: "+10,000 conversations",
		price: "$29 / mo",
		blurb: "Top up usage on any tier without upgrading.",
	},
	{
		title: "Remove Leadly branding",
		price: "$19 / mo",
		blurb: "Drop the small 'Powered by Leadly' on the widget.",
	},
	{
		title: "Extra team seat",
		price: "$8 / mo",
		blurb: "Add a teammate to your inbox above your tier limit.",
	},
];

const FAQS = [
	{
		q: "What counts as a conversation?",
		a: "One unique session between a visitor and your agent — regardless of how many turns it has. A 30-message conversation and a 3-message conversation each count as one.",
	},
	{
		q: "What happens if I go over the conversation limit?",
		a: "Nothing breaks. We notify you, and you can either upgrade or buy a +10,000 conversations add-on. We never silently overcharge you.",
	},
	{
		q: "Can I bring my own LLM key?",
		a: "Yes — on every plan. Plug in your OpenAI, Anthropic, Google, Mistral, or Groq key, or point Leadly at a local model. The platform fee is the same either way; you just pay your provider directly for tokens instead of us.",
	},
	{
		q: "Can I self-host instead?",
		a: "Yes. Leadly is open source — clone the repo, run docker compose, and you're on your own infrastructure. Hosted is for teams who'd rather not.",
	},
	{
		q: "Is there a free trial?",
		a: "All paid plans include a 14-day trial — full access, no credit card. While Leadly is in preview, every paid plan is free; you'll have plenty of notice before billing starts.",
	},
	{
		q: "Can I change plans later?",
		a: "Anytime, from your dashboard. Upgrades are prorated; downgrades take effect at the end of the current billing period.",
	},
];

function PricingPage() {
	const [cycle, setCycle] = useState<Cycle>("yearly");

	return (
		<div className="bg-background">
			{/* Preview banner */}
			<div className="border-b border-border/60 bg-card/60">
				<div className="container mx-auto max-w-6xl px-4 py-3 text-center text-xs text-muted-foreground">
					<span className="font-mono uppercase tracking-[0.18em] text-foreground">
						Preview
					</span>{" "}
					· Every plan is free during the preview. Prices below take effect at
					general availability.
				</div>
			</div>

			{/* Header */}
			<section className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
				<div className="mx-auto max-w-2xl text-center">
					<Badge
						variant="outline"
						className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em]"
					>
						Pricing
					</Badge>
					<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-6xl">
						Pay for the support you replace.
					</h1>
					<p className="mt-5 text-pretty text-base text-muted-foreground md:text-lg">
						Flat tiers, predictable bills, no per-message surprises. Bring
						your own LLM key and we don't take a cut of your tokens.
					</p>

					{/* Cycle toggle */}
					<div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
						<button
							type="button"
							onClick={() => setCycle("monthly")}
							className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
								cycle === "monthly"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Monthly
						</button>
						<button
							type="button"
							onClick={() => setCycle("yearly")}
							className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
								cycle === "yearly"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Yearly
							<span className="ml-2 rounded-full bg-background/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
								−40%
							</span>
						</button>
					</div>
				</div>

				{/* Tier cards */}
				<div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					{TIERS.map((tier) => (
						<TierCard key={tier.id} tier={tier} cycle={cycle} />
					))}
				</div>
			</section>

			{/* Add-ons */}
			<section className="border-t border-border/60 bg-background py-16 md:py-20">
				<div className="container mx-auto max-w-6xl px-4">
					<div className="mb-10 max-w-2xl">
						<Badge
							variant="outline"
							className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em]"
						>
							Add-ons
						</Badge>
						<h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
							Top up without upgrading.
						</h2>
						<p className="mt-3 text-sm text-muted-foreground md:text-base">
							Stack any add-on onto any plan. Cancel anytime from billing
							settings.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						{ADDONS.map((a) => (
							<div
								key={a.title}
								className="rounded-2xl border border-border bg-card p-6"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40">
										<Plus className="h-4 w-4 text-foreground" />
									</div>
									<div className="font-mono text-sm font-medium tracking-tight text-foreground">
										{a.price}
									</div>
								</div>
								<h3 className="mt-4 text-base font-semibold tracking-tight">
									{a.title}
								</h3>
								<p className="mt-1.5 text-sm text-muted-foreground">
									{a.blurb}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section className="border-t border-border/60 py-20 md:py-28">
				<div className="container mx-auto max-w-3xl px-4">
					<div className="mb-10 text-center md:mb-14">
						<Badge
							variant="outline"
							className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em]"
						>
							Pricing FAQ
						</Badge>
						<h2 className="text-balance text-3xl font-semibold tracking-tighter md:text-5xl">
							Pricing, answered.
						</h2>
					</div>
					<div className="rounded-2xl border border-border bg-card px-6 md:px-8">
						<Accordion type="single" collapsible className="w-full">
							{FAQS.map((item, i) => (
								<AccordionItem
									key={item.q}
									value={`faq-${i}`}
									className="border-border/60"
								>
									<AccordionTrigger className="py-5 text-left text-base font-medium tracking-tight hover:no-underline md:text-lg">
										{item.q}
									</AccordionTrigger>
									<AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground md:text-base">
										{item.a}
									</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>
			</section>

			{/* Final CTA */}
			<section className="pb-24 md:pb-32">
				<div className="container mx-auto max-w-4xl px-4">
					<div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-14 text-center md:px-14 md:py-20">
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-foreground)_0%,transparent_60%)] opacity-[0.05]"
						/>
						<div className="relative">
							<h2 className="text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
								Free during preview. No credit card.
							</h2>
							<p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
								Set up an agent today, decide on a plan whenever billing turns
								on.
							</p>
							<div className="mt-8 flex justify-center">
								<Button
									size="lg"
									asChild
									className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
								>
									<Link to="/auth">
										Start free
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

function TierCard({ tier, cycle }: { tier: Tier; cycle: Cycle }) {
	const yearlyMonthly =
		tier.monthly !== null ? Math.round(tier.monthly * 0.6) : null;
	const annualTotal =
		tier.monthly !== null && yearlyMonthly !== null ? yearlyMonthly * 12 : null;
	const displayMonthly =
		cycle === "yearly" && yearlyMonthly !== null ? yearlyMonthly : tier.monthly;

	return (
		<div
			className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
				tier.highlighted
					? "border-accent-blue/50 shadow-[0_0_0_1px_var(--accent-blue)] shadow-accent-blue/10"
					: "border-border"
			}`}
		>
			{tier.highlighted && (
				<span className="absolute -top-3 left-6 rounded-full bg-accent-blue px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-blue-foreground">
					Most popular
				</span>
			)}

			<div>
				<h3 className="text-base font-semibold tracking-tight">{tier.name}</h3>
				<p className="mt-2 min-h-[2.75rem] text-sm leading-snug text-muted-foreground">
					{tier.pitch}
				</p>
			</div>

			<div className="mt-5">
				{tier.monthly === null ? (
					<div className="flex items-baseline gap-1">
						<span className="text-3xl font-semibold tracking-tighter">
							Custom
						</span>
					</div>
				) : displayMonthly === 0 ? (
					<div className="flex items-baseline gap-1">
						<span className="text-3xl font-semibold tracking-tighter">$0</span>
						<span className="text-sm text-muted-foreground">/ forever</span>
					</div>
				) : (
					<>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-semibold tracking-tighter">
								${displayMonthly}
							</span>
							<span className="text-sm text-muted-foreground">/ mo</span>
						</div>
						{cycle === "yearly" && annualTotal !== null && (
							<div className="mt-1 font-mono text-[11px] text-muted-foreground/80">
								billed ${annualTotal} yearly
							</div>
						)}
					</>
				)}
			</div>

			<Button
				asChild
				variant={tier.highlighted ? "default" : "outline"}
				className={
					tier.highlighted
						? "mt-5 w-full bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
						: "mt-5 w-full"
				}
			>
				<Link to={tier.cta.href}>{tier.cta.label}</Link>
			</Button>

			<div className="mt-6 space-y-2.5 border-t border-border/60 pt-5">
				{tier.limits.map((l) => (
					<div
						key={l.label}
						className="flex items-baseline justify-between text-sm"
					>
						<span className="text-muted-foreground">{l.label}</span>
						<span className="font-medium text-foreground">{l.value}</span>
					</div>
				))}
			</div>

			<ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-sm">
				{tier.features.map((f) => (
					<li
						key={f.label}
						className="flex items-start gap-2 text-muted-foreground"
					>
						<Check
							className={`mt-0.5 h-4 w-4 shrink-0 ${
								f.premium ? "text-accent-blue" : "text-foreground"
							}`}
						/>
						<span className={f.premium ? "font-medium text-foreground" : ""}>
							{f.label}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
