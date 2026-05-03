import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/docs")({
	component: DocsPage,
});

const SECTIONS = [
	{
		title: "Getting started",
		description: "Sign up, create an agent, drop the widget on your site.",
		links: [
			"Quickstart",
			"Creating an agent",
			"Installing the widget",
			"Identifying logged-in visitors",
		],
	},
	{
		title: "Knowledge base",
		description: "Authoring articles and managing what your agent knows.",
		links: [
			"Writing in Markdown",
			"Uploading documents",
			"How retrieval works",
			"Citing sources in replies",
		],
	},
	{
		title: "Inbox & takeover",
		description: "How conversations land and how you step in.",
		links: [
			"Reading transcripts",
			"Taking over a conversation",
			"Agent vs human turns",
			"Handoff routing",
		],
	},
	{
		title: "Models & BYOK",
		description: "Provider selection and bringing your own keys.",
		links: [
			"Supported providers",
			"Adding API keys",
			"Per-agent overrides",
			"Self-hosted model endpoints",
		],
	},
];

function DocsPage() {
	return (
		<PageShell
			eyebrow="Docs"
			title="Documentation."
			description="Everything you need to set up Leadly, configure an agent, and grow with it."
		>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{SECTIONS.map((sec) => (
					<div
						key={sec.title}
						className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-border/80"
					>
						<h3 className="text-lg font-semibold tracking-tight">
							{sec.title}
						</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							{sec.description}
						</p>
						<ul className="mt-5 space-y-2 text-sm">
							{sec.links.map((l) => (
								<li key={l}>
									<a
										href="#"
										className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
									>
										<ArrowRight className="h-3.5 w-3.5" />
										{l}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>

			<Section title="Looking for the API reference?">
				<p>
					The Leadly API is OpenAPI-documented. Once your account is set up,
					the live spec is available from your dashboard under{" "}
					<span className="font-medium text-foreground">Settings → API</span>.
				</p>
			</Section>
		</PageShell>
	);
}
