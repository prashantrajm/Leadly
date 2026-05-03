import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/integrations")({
	component: IntegrationsPage,
});

const INTEGRATIONS = [
	{ name: "OpenAI", category: "LLM", status: "Available" },
	{ name: "Anthropic", category: "LLM", status: "Available" },
	{ name: "Google", category: "LLM", status: "Available" },
	{ name: "Mistral", category: "LLM", status: "Available" },
	{ name: "Groq", category: "LLM", status: "Available" },
	{ name: "Local (Ollama, LM Studio)", category: "LLM", status: "Available" },
	{ name: "Stripe", category: "Billing", status: "Coming soon" },
	{ name: "Slack", category: "Notifications", status: "Coming soon" },
	{ name: "HubSpot", category: "CRM", status: "Coming soon" },
	{ name: "Salesforce", category: "CRM", status: "Coming soon" },
	{ name: "Shopify", category: "Commerce", status: "Coming soon" },
	{ name: "Zapier", category: "Automation", status: "Coming soon" },
];

function IntegrationsPage() {
	return (
		<PageShell
			eyebrow="Integrations"
			title="Plays well with the rest of your stack."
			description="Connect Leadly to the model providers you already use, and wire conversations into the tools your team lives in."
		>
			<Section title="Currently shipping">
				<p>
					Every model provider that Vercel's AI SDK supports works with Leadly
					on day one. Bring your own key, pick a model per agent, switch
					anytime.
				</p>
			</Section>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{INTEGRATIONS.map((it) => (
					<div
						key={it.name}
						className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
					>
						<div className="min-w-0">
							<div className="truncate text-sm font-medium">{it.name}</div>
							<div className="text-xs text-muted-foreground">{it.category}</div>
						</div>
						<span
							className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
								it.status === "Available"
									? "border-foreground/30 bg-secondary text-foreground"
									: "border-border bg-card text-muted-foreground"
							}`}
						>
							{it.status}
						</span>
					</div>
				))}
			</div>

			<Section title="Don't see what you need?">
				<p>
					Custom HTTP tools land in the next release — point Leadly at any
					authenticated endpoint and the agent can call it during a
					conversation. If you have a specific integration request, drop us a
					note.
				</p>
			</Section>
		</PageShell>
	);
}
