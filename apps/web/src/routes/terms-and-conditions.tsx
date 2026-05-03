import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms-and-conditions")({
	component: TermsOfService,
});

function TermsOfService() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-20 md:py-28">
			<header className="mb-14 border-b border-border/60 pb-10">
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					Legal
				</p>
				<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-5xl">
					Terms of Service
				</h1>
				<p className="mt-4 text-sm text-muted-foreground">
					Last updated: May 3, 2026
				</p>
			</header>

			<div className="space-y-12 text-foreground">
				<Section title="1. Agreement">
					<p>
						These Terms of Service ("Terms") govern your access to and use of
						Leadly ("the Service"), provided by Leadly. By creating an account
						or using the Service, you agree to be bound by these Terms. If you
						are using the Service on behalf of an organization, you represent
						that you have authority to bind that organization, and "you" refers
						to that organization.
					</p>
				</Section>

				<Section title="2. The Service">
					<p>
						Leadly provides an AI-powered customer support platform — an
						embeddable chat widget, a knowledge base with retrieval, lead
						capture, and a live human-takeover inbox. Features and limits may
						change over time. We will provide reasonable notice of material
						changes that adversely affect your existing plan.
					</p>
				</Section>

				<Section title="3. Account & access">
					<List>
						<li>
							You are responsible for safeguarding your account credentials and
							for any activity that occurs under your account.
						</li>
						<li>
							You must be at least 16 years old to create an account.
						</li>
						<li>
							You agree to provide accurate billing and contact information and
							to keep it up to date.
						</li>
						<li>
							We may suspend or terminate accounts that we reasonably believe
							are being used in violation of these Terms.
						</li>
					</List>
				</Section>

				<Section title="4. Subscriptions & billing">
					<List>
						<li>
							Paid plans consist of a recurring subscription fee plus
							usage-based charges above included quotas, as described on our
							pricing page.
						</li>
						<li>
							Subscriptions renew automatically at the end of each billing
							cycle until cancelled. You can cancel at any time from your
							dashboard; the cancellation takes effect at the end of the
							current billing period.
						</li>
						<li>
							Fees are exclusive of applicable taxes, which we may add to
							invoices where required by law.
						</li>
						<li>
							Refunds are handled in accordance with our{" "}
							<a
								href="/refund-policy"
								className="text-foreground underline-offset-4 hover:underline"
							>
								Refund Policy
							</a>
							.
						</li>
						<li>
							If a payment fails, we may suspend access to paid features until
							the balance is resolved.
						</li>
					</List>
				</Section>

				<Section title="5. Bring your own model (BYOK)">
					<p>
						If you configure your agent to use your own LLM provider API key,
						you are responsible for the costs, terms, and acceptable-use
						policies of that provider. Leadly's subscription fee is independent
						of and in addition to any costs incurred with the model provider.
					</p>
				</Section>

				<Section title="6. Your content">
					<p>
						You retain all rights to the content you upload to Leadly,
						including knowledge base articles, agent configurations,
						conversation transcripts, and lead data ("Your Content"). You grant
						Leadly a limited, worldwide, non-exclusive license to host, store,
						process, and transmit Your Content solely to provide the Service to
						you.
					</p>
					<p>
						We do not use Your Content to train shared or third-party models.
					</p>
				</Section>

				<Section title="7. Acceptable use">
					<p>You agree not to use the Service to:</p>
					<List>
						<li>
							Engage in unlawful, infringing, deceptive, or harmful activity.
						</li>
						<li>
							Send spam, harvest contact information, or otherwise abuse end
							users.
						</li>
						<li>
							Reverse-engineer, scrape, or attempt to circumvent the Service's
							rate limits or security measures.
						</li>
						<li>
							Generate content that infringes third-party rights, contains
							malware, or violates applicable AI safety obligations.
						</li>
						<li>
							Impersonate another person or organization in a way that is
							misleading or fraudulent.
						</li>
					</List>
					<p>
						We may remove content or suspend access to address violations of
						this section.
					</p>
				</Section>

				<Section title="8. AI-generated content">
					<p>
						Leadly produces responses using third-party large language models.
						Outputs may be inaccurate, incomplete, or unsuitable for a given
						purpose. You are responsible for reviewing AI-generated content
						before relying on it for important decisions and for ensuring your
						use of the Service complies with applicable laws.
					</p>
				</Section>

				<Section title="9. Intellectual property">
					<p>
						The Service, including all software, designs, and trademarks
						associated with it, is owned by Leadly or its licensors. The Leadly
						source code is open source and licensed under the Apache License,
						Version 2.0; the hosted Service and the Leadly trademark are not
						licensed to you under these Terms beyond the right to use the
						Service in accordance with them.
					</p>
				</Section>

				<Section title="10. Termination">
					<List>
						<li>
							You may stop using the Service or close your account at any time.
						</li>
						<li>
							We may terminate or suspend your account if you materially breach
							these Terms, if your account becomes inactive, or if we are
							required to do so by law.
						</li>
						<li>
							Upon termination, we will delete your data in accordance with our
							Privacy Policy, subject to legal retention obligations.
						</li>
					</List>
				</Section>

				<Section title="11. Disclaimers">
					<p>
						The Service is provided "as is" and "as available" without
						warranties of any kind, whether express or implied, including
						warranties of merchantability, fitness for a particular purpose,
						and non-infringement. We do not warrant that the Service will be
						uninterrupted, error-free, or that AI-generated outputs will be
						accurate.
					</p>
				</Section>

				<Section title="12. Limitation of liability">
					<p>
						To the maximum extent permitted by law, Leadly's aggregate
						liability for any claims arising out of or relating to these Terms
						or the Service will not exceed the greater of (a) the amount you
						paid us for the Service in the twelve months preceding the event
						giving rise to the claim, or (b) US$100. Leadly will not be liable
						for indirect, incidental, special, consequential, or exemplary
						damages.
					</p>
				</Section>

				<Section title="13. Indemnification">
					<p>
						You agree to defend, indemnify, and hold harmless Leadly from any
						claims, damages, and expenses arising from your use of the Service,
						Your Content, or your violation of these Terms.
					</p>
				</Section>

				<Section title="14. Changes">
					<p>
						We may update these Terms from time to time. When we make material
						changes, we will update the "Last updated" date and, where
						appropriate, notify you in the dashboard or by email. Continued use
						of the Service after changes take effect constitutes acceptance.
					</p>
				</Section>

				<Section title="15. Governing law">
					<p>
						These Terms are governed by the laws of the jurisdiction in which
						Leadly is established, without regard to conflict-of-laws
						principles. Any disputes will be resolved in the competent courts
						of that jurisdiction, except where applicable consumer-protection
						law gives you a different right.
					</p>
				</Section>

				<section className="rounded-2xl border border-border bg-card p-8">
					<h2 className="text-xl font-semibold tracking-tight">16. Contact</h2>
					<p className="mt-3 text-muted-foreground">
						Questions about these Terms?
					</p>
					<p className="mt-3 font-mono text-sm">legal@leadly.app</p>
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

function List({ children }: { children: React.ReactNode }) {
	return (
		<ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground/40">
			{children}
		</ul>
	);
}
