import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
	component: RefundPolicy,
});

function RefundPolicy() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-20 md:py-28">
			<header className="mb-14 border-b border-border/60 pb-10">
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					Legal
				</p>
				<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-5xl">
					Refund & Cancellation Policy
				</h1>
				<p className="mt-4 text-sm text-muted-foreground">
					Last updated: May 3, 2026
				</p>
			</header>

			<div className="space-y-12 text-foreground">
				<Section title="1. Summary">
					<p>
						You can cancel your Leadly subscription at any time. We offer a
						14-day refund window on first-time paid subscriptions. After the
						window, fees are non-refundable, and your subscription continues
						until the end of the billing period for which you have already
						paid.
					</p>
				</Section>

				<Section title="2. Cancelling your subscription">
					<List>
						<li>
							You can cancel from your dashboard under{" "}
							<span className="font-medium text-foreground">
								Settings → Billing
							</span>
							, or by emailing us.
						</li>
						<li>
							Cancellation takes effect at the end of the current billing
							period. You will continue to have access to paid features until
							then.
						</li>
						<li>
							We do not pro-rate refunds for unused time after a cancellation
							outside of the conditions described in section 3.
						</li>
						<li>
							When the subscription ends, your account remains accessible on
							the free tier (if available) or in a read-only state for 30 days,
							after which we may delete account data in accordance with our
							Privacy Policy.
						</li>
					</List>
				</Section>

				<Section title="3. Refunds">
					<SubSection label="3.1 14-day refund window">
						If you are not satisfied with Leadly, you can request a full refund
						within 14 days of your first paid subscription charge. The 14-day
						window applies once per customer and does not reset on plan upgrades
						or renewals.
					</SubSection>
					<SubSection label="3.2 Annual plans">
						For annual plans cancelled after the 14-day window, the remaining
						unused months are non-refundable.
					</SubSection>
					<SubSection label="3.3 Usage-based charges">
						Fees billed for actual usage above your included quota (such as
						additional conversations) are non-refundable, because they reflect
						services we have already delivered.
					</SubSection>
					<SubSection label="3.4 Service issues">
						If you experience a significant Service outage or material defect
						attributable to Leadly that we are unable to resolve in a
						reasonable time, contact us — we will consider partial credits or
						refunds case by case, even outside the 14-day window.
					</SubSection>
					<SubSection label="3.5 How refunds are issued">
						Approved refunds are issued to the original payment method through
						our payment provider, typically within 5–10 business days,
						depending on your bank.
					</SubSection>
				</Section>

				<Section title="4. Non-refundable items">
					<List>
						<li>
							Charges incurred more than 14 days before the refund request,
							except as described in section 3.4.
						</li>
						<li>
							Usage-based overage charges already invoiced.
						</li>
						<li>
							Charges arising from your own LLM provider when using
							bring-your-own-key (BYOK) — these are billed directly by that
							provider and are not within Leadly's control.
						</li>
						<li>
							Fees waived or discounted as part of a promotion, where stated as
							non-refundable at the time of purchase.
						</li>
					</List>
				</Section>

				<Section title="5. Chargebacks">
					<p>
						Please contact us before initiating a chargeback. Most billing
						questions can be resolved quickly by email, and we'd rather refund
						you than have a dispute on record. If a chargeback is filed, we may
						suspend the account pending resolution.
					</p>
				</Section>

				<Section title="6. How to request a refund">
					<List>
						<li>
							Email{" "}
							<span className="font-mono text-sm text-foreground">
								billing@leadly.app
							</span>{" "}
							from the email address associated with your account.
						</li>
						<li>
							Include your organization name and a brief description of why you
							are requesting the refund.
						</li>
						<li>
							We aim to respond within two business days.
						</li>
					</List>
				</Section>

				<section className="rounded-2xl border border-border bg-card p-8">
					<h2 className="text-xl font-semibold tracking-tight">7. Contact</h2>
					<p className="mt-3 text-muted-foreground">
						Billing questions or refund requests:
					</p>
					<p className="mt-3 font-mono text-sm">billing@leadly.app</p>
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
