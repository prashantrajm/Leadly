import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicy,
});

function PrivacyPolicy() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-20 md:py-28">
			<header className="mb-14 border-b border-border/60 pb-10">
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					Legal
				</p>
				<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-5xl">
					Privacy Policy
				</h1>
				<p className="mt-4 text-sm text-muted-foreground">
					Last updated: May 3, 2026
				</p>
			</header>

			<div className="space-y-12 text-foreground">
				<Section title="1. Who we are">
					<p>
						Leadly ("we," "us," "our") provides an AI-powered customer support
						platform — an embeddable chat widget, a knowledge base, retrieval,
						lead capture, and a live human-takeover inbox. This Privacy Policy
						explains what data we collect when you use Leadly as a customer
						(an account holder), and what data we process on behalf of our
						customers when their visitors interact with the widget.
					</p>
					<p>
						If you are a visitor talking to a Leadly-powered widget on a third
						party's website, the website operator — not Leadly — is the data
						controller for that conversation. This policy describes our role as
						a data processor in those interactions.
					</p>
				</Section>

				<Section title="2. Information we collect">
					<SubSection label="2.1 Account information">
						When you create a Leadly account, we collect your name, email
						address, profile image (if you sign in with an OAuth provider),
						organization name, billing details, and any settings you configure
						for your agents (persona, knowledge base content, integrations).
					</SubSection>
					<SubSection label="2.2 Conversation data">
						We process the contents of conversations between your visitors and
						your agent — chat messages, retrieved knowledge base passages,
						tool-call inputs and outputs, and conversation metadata
						(timestamps, channel, status). This data is stored on your behalf
						so you can review transcripts and analytics in your dashboard.
					</SubSection>
					<SubSection label="2.3 Lead data">
						When a visitor provides their name, email, phone number, or other
						contact information during a conversation — either directly or
						through your <code className="font-mono text-xs">identify()</code>{" "}
						integration — we store it as a Lead record associated with your
						agent.
					</SubSection>
					<SubSection label="2.4 Technical data">
						We log standard technical information such as IP address, user
						agent, request timestamps, and error traces for security,
						debugging, and abuse prevention.
					</SubSection>
				</Section>

				<Section title="3. How we use your information">
					<List>
						<li>To provide, maintain, and improve the Leadly service.</li>
						<li>
							To process subscriptions and usage-based billing through our
							payment provider.
						</li>
						<li>
							To respond to support requests and communicate service-related
							notices.
						</li>
						<li>
							To detect, investigate, and prevent fraud, abuse, and security
							incidents.
						</li>
						<li>
							To comply with legal obligations and enforce our Terms of
							Service.
						</li>
					</List>
					<p>
						We do not sell your personal data, and we do not use the contents
						of your conversations or knowledge base to train shared models.
					</p>
				</Section>

				<Section title="4. Subprocessors">
					<p>
						Leadly relies on a small number of third-party services to deliver
						the platform. Each subprocessor receives only the data needed to
						perform its function:
					</p>
					<List>
						<li>
							<strong>Database & file storage:</strong> a managed Postgres
							provider and an S3-compatible object storage provider host
							account data, conversation records, and uploaded files.
						</li>
						<li>
							<strong>LLM and embedding providers:</strong> when your agent
							processes a turn, the conversation context is sent to the model
							provider you have selected (e.g. OpenAI, Anthropic, Google,
							Mistral). If you bring your own API key, that provider's terms
							apply directly to that traffic.
						</li>
						<li>
							<strong>Payment processing:</strong> billing is handled by our
							payment provider; we do not store full card details.
						</li>
					</List>
				</Section>

				<Section title="5. Data retention">
					<p>
						We retain account data for as long as your account is active. You
						can delete individual conversations, leads, and knowledge base
						articles at any time from the dashboard. When you delete your
						account, we remove your account data and associated records within
						30 days, except where we are required to retain certain information
						(for example, billing records) by law.
					</p>
				</Section>

				<Section title="6. Security">
					<p>
						We use TLS in transit, encrypt sensitive credentials at rest with
						AES-256-GCM, and follow the principle of least privilege for
						internal access. No system is perfectly secure, but we work to
						reduce risk and respond quickly when incidents occur.
					</p>
				</Section>

				<Section title="7. Your rights">
					<p>
						Depending on your jurisdiction, you may have the right to access,
						correct, export, or delete personal information we hold about you,
						and to object to or restrict certain processing. You can exercise
						most of these rights directly in your dashboard. For anything else,
						contact us at the address below.
					</p>
				</Section>

				<Section title="8. International transfers">
					<p>
						Leadly may process and store data in countries other than the one
						in which you reside. Where required, we put appropriate safeguards
						in place for international transfers.
					</p>
				</Section>

				<Section title="9. Children">
					<p>
						Leadly is not directed at children under 16, and we do not
						knowingly collect personal information from them. If you believe a
						child has provided personal information through Leadly, please
						contact us so we can remove it.
					</p>
				</Section>

				<Section title="10. Changes to this policy">
					<p>
						We may update this Privacy Policy from time to time. When we make
						material changes, we will update the "Last updated" date and, where
						appropriate, notify you in the dashboard or by email.
					</p>
				</Section>

				<section className="rounded-2xl border border-border bg-card p-8">
					<h2 className="text-xl font-semibold tracking-tight">11. Contact</h2>
					<p className="mt-3 text-muted-foreground">
						Questions about this policy or how we handle your data?
					</p>
					<p className="mt-3 font-mono text-sm">privacy@leadly.app</p>
				</section>
			</div>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-4">
			<h2 className="text-xl font-semibold tracking-tight md:text-2xl">
				{title}
			</h2>
			<div className="space-y-3 leading-relaxed text-muted-foreground">
				{children}
			</div>
		</section>
	);
}

function SubSection({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<p className="font-medium text-foreground">{label}</p>
			<p>{children}</p>
		</div>
	);
}

function List({ children }: { children: React.ReactNode }) {
	return (
		<ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground/40">
			{children}
		</ul>
	);
}
