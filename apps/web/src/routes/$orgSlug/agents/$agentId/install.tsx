import type { Agent } from "@leadly/api-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";

export const Route = createFileRoute("/$orgSlug/agents/$agentId/install")({
	component: InstallPage,
});

function InstallPage() {
	const { agentId } = Route.useParams();

	const agentQuery = useQuery({
		queryKey: ["agent", agentId],
		queryFn: () => api.agents.get(agentId),
	});

	// Used to mark the "first conversation" step as done.
	const conversationsQuery = useQuery({
		queryKey: ["conversations-any", agentId],
		queryFn: () => api.conversations.list(agentId, { limit: 1 }),
	});

	if (agentQuery.isLoading) {
		return (
			<div className="mx-auto max-w-4xl">
				<Skeleton className="h-10 w-40 rounded-md" />
				<Skeleton className="mt-6 h-80 rounded-xl" />
			</div>
		);
	}

	if (agentQuery.isError || !agentQuery.data) {
		return (
			<div className="mx-auto max-w-4xl">
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{agentQuery.error instanceof LeadlyApiError
						? `API ${agentQuery.error.status}: ${agentQuery.error.message}`
						: "Could not load agent."}
				</div>
			</div>
		);
	}

	const agent = agentQuery.data;
	const hasConversation = (conversationsQuery.data?.items.length ?? 0) > 0;

	return (
		<div className="mx-auto max-w-4xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">
					Install the widget
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Drop one script tag on your site and the agent shows up. No SDK, no
					build step.
				</p>
			</header>

			<div className="space-y-4">
				<Step n={1} title="Copy the script" done>
					<SnippetTabs agent={agent} />
				</Step>

				<Step n={2} title="Drop it in your page's <head>" done>
					<p className="text-sm text-muted-foreground">
						Anywhere inside <Code>&lt;head&gt;</Code> works. The script is
						deferred so it never blocks page load. The widget bubble appears
						bottom-right by default.
					</p>
				</Step>

				<Step n={3} title="Test it">
					<TestStep agentId={agent.id} />
				</Step>

				<Step
					n={4}
					title="Verify"
					done={hasConversation}
					subtle={!hasConversation}
				>
					{hasConversation ? (
						<p className="text-sm text-muted-foreground">
							We've seen at least one conversation on this agent — your widget
							is live.
						</p>
					) : (
						<p className="text-sm text-muted-foreground">
							This step ticks off automatically when your first real
							conversation arrives. Refresh after dropping the script on your
							site.
						</p>
					)}
				</Step>
			</div>
		</div>
	);
}

function Step({
	n,
	title,
	done,
	subtle,
	children,
}: {
	n: number;
	title: string;
	done?: boolean;
	subtle?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Card className={subtle ? "border-dashed" : undefined}>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div
						className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
							done
								? "bg-accent-blue text-accent-blue-foreground"
								: "border border-border bg-card text-muted-foreground"
						}`}
					>
						{done ? <Check className="size-3.5" /> : n}
					</div>
					<CardTitle className="text-base">{title}</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="pl-[3.25rem]">{children}</CardContent>
		</Card>
	);
}

function SnippetTabs({ agent }: { agent: Agent }) {
	const apiUrl = (
		import.meta.env.VITE_API_URL || "http://localhost:8787/api"
	).replace(/\/api\/?$/, "");
	const loaderUrl =
		import.meta.env.VITE_WIDGET_LOADER_URL ||
		(typeof window === "undefined"
			? "https://cdn.leadly.app/loader.js"
			: `${window.location.origin}/loader.js`);

	const html = `<script
  src="${loaderUrl}"
  data-agent-id="${agent.id}"
  data-api-url="${apiUrl}"
  defer
></script>`;

	const react = `// Anywhere a layout component renders <head>
// (e.g. _document.tsx in Next.js, root.tsx in Remix)
<script
  src="${loaderUrl}"
  data-agent-id="${agent.id}"
  data-api-url="${apiUrl}"
  defer
/>`;

	const shopify = `<!-- theme.liquid, inside <head> -->
<script
  src="${loaderUrl}"
  data-agent-id="${agent.id}"
  data-api-url="${apiUrl}"
  defer
></script>`;

	const wp = `// In your theme's functions.php
function leadly_widget() {
  ?>
  <script
    src="${loaderUrl}"
    data-agent-id="${agent.id}"
    data-api-url="${apiUrl}"
    defer
  ></script>
  <?php
}
add_action('wp_head', 'leadly_widget');`;

	return (
		<Tabs defaultValue="html">
			<TabsList>
				<TabsTrigger value="html">HTML</TabsTrigger>
				<TabsTrigger value="react">React / Next</TabsTrigger>
				<TabsTrigger value="shopify">Shopify</TabsTrigger>
				<TabsTrigger value="wp">WordPress</TabsTrigger>
			</TabsList>
			<TabsContent value="html" className="mt-3">
				<Snippet code={html} />
			</TabsContent>
			<TabsContent value="react" className="mt-3">
				<Snippet code={react} />
			</TabsContent>
			<TabsContent value="shopify" className="mt-3">
				<Snippet code={shopify} />
			</TabsContent>
			<TabsContent value="wp" className="mt-3">
				<Snippet code={wp} />
			</TabsContent>
		</Tabs>
	);
}

function Snippet({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			/* clipboard blocked */
		}
	}

	return (
		<div className="relative overflow-hidden rounded-lg border border-border bg-secondary/40">
			<button
				type="button"
				onClick={copy}
				className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
					copied
						? "bg-accent-blue text-accent-blue-foreground"
						: "bg-background/80 text-muted-foreground backdrop-blur hover:bg-background hover:text-foreground"
				}`}
			>
				{copied ? (
					<>
						<Check className="size-3.5" />
						Copied
					</>
				) : (
					<>
						<Copy className="size-3.5" />
						Copy
					</>
				)}
			</button>
			<pre className="overflow-x-auto px-4 py-3 pr-20 font-mono text-[12.5px] leading-relaxed text-foreground/90">
				<code>{code}</code>
			</pre>
		</div>
	);
}

function TestStep({ agentId }: { agentId: string }) {
	const orgPath = useOrgPath();
	return (
		<div className="space-y-3 text-sm text-muted-foreground">
			<p>Two ways to confirm the agent works before you ship:</p>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Button
					asChild
					variant="outline"
					className="h-auto flex-col items-start gap-1 py-3"
				>
					<Link
						to={orgPath(`/agents/${agentId}/playground`) as string}
						className="text-left"
					>
						<span className="flex w-full items-center gap-2 text-sm font-semibold text-foreground">
							<Play className="size-4 text-accent-blue" />
							Open Playground
						</span>
						<span className="text-xs font-normal text-muted-foreground">
							Same pipeline as the real widget, no installation.
						</span>
					</Link>
				</Button>
				<Button
					asChild
					variant="outline"
					className="h-auto flex-col items-start gap-1 py-3"
				>
					<a
						href={`https://leadly.app/test?agent=${agentId}`}
						target="_blank"
						rel="noreferrer"
						className="text-left"
					>
						<span className="flex w-full items-center gap-2 text-sm font-semibold text-foreground">
							<ExternalLink className="size-4 text-accent-blue" />
							Live test page
						</span>
						<span className="text-xs font-normal text-muted-foreground">
							Loads the actual widget on a hosted page.
						</span>
					</a>
				</Button>
			</div>
		</div>
	);
}

function Code({ children }: { children: React.ReactNode }) {
	return (
		<code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[0.85em]">
			{children}
		</code>
	);
}
