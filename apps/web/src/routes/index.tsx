import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { FeaturesSection } from "@/components/features";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<>
			<Hero />
			<TrustStrip />
			<FeaturesSection />
			<ProductShot />
			<ClosingCta />
		</>
	);
}

function Hero() {
	return (
		<section className="relative overflow-hidden bg-background">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[520px] max-w-5xl rounded-full bg-foreground/[0.04] blur-3xl"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-foreground)_0%,transparent_45%)] opacity-[0.03]"
			/>
			<div className="container relative mx-auto max-w-5xl px-4 pt-24 pb-28 md:pt-32 md:pb-36">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
					className="mx-auto max-w-3xl text-center"
				>
					<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
						</span>
						Live human takeover, no awkward handoff
					</div>

					<h1 className="text-balance text-5xl font-semibold tracking-tighter md:text-6xl lg:text-7xl">
						AI support that knows{" "}
						<span className="bg-gradient-to-b from-foreground to-foreground/55 bg-clip-text text-transparent">
							when to step aside.
						</span>
					</h1>

					<p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
						Leadly answers your visitors instantly. When a real person needs to
						step in, they take over the conversation — same name, same voice,
						no awkward "let me transfer you."
					</p>

					<div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Button size="lg" asChild>
							<Link to="/auth">
								Get started
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button size="lg" variant="outline" asChild>
							<a href="#features">See how it works</a>
						</Button>
					</div>

					<p className="mt-5 text-xs text-muted-foreground">
						No credit card. Set up in under five minutes.
					</p>
				</motion.div>
			</div>
		</section>
	);
}

const TRUST_BRANDS = ["Northbeam", "Lattice", "Helix", "Parallel", "Foundry"];

function TrustStrip() {
	return (
		<section className="border-y border-border/60 bg-background">
			<div className="container mx-auto max-w-6xl px-4 py-10">
				<p className="mb-6 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
					Built for teams who care how their support feels
				</p>
				<div className="grid grid-cols-2 items-center gap-6 sm:grid-cols-3 md:grid-cols-5">
					{TRUST_BRANDS.map((brand) => (
						<div
							key={brand}
							className="text-center font-mono text-sm tracking-wider text-muted-foreground/55 transition-colors hover:text-muted-foreground"
						>
							{brand.toLowerCase()}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function ProductShot() {
	return (
		<section className="bg-background py-20 md:py-28">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
					<h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
						One inbox. Both kinds of replies.
					</h2>
					<p className="mt-4 text-base text-muted-foreground md:text-lg">
						Watch your agent work in real time. Step in with a click — your
						visitor never knows the difference.
					</p>
				</div>

				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-80px" }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="relative mx-auto max-w-5xl"
				>
					<div
						aria-hidden
						className="pointer-events-none absolute -inset-x-12 -top-12 -bottom-12 bg-[radial-gradient(ellipse_at_center,var(--color-foreground)_0%,transparent_60%)] opacity-[0.05] blur-2xl"
					/>
					<div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
						{/* Window chrome */}
						<div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
							<div className="flex items-center gap-1.5">
								<span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
								<span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
								<span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
							</div>
							<div className="font-mono text-[11px] tracking-wider text-muted-foreground/70">
								app.leadly.local / inbox
							</div>
							<div className="w-12" />
						</div>

						<div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
							{/* Sidebar — conversation list */}
							<div className="hidden border-r border-border/60 bg-secondary/20 md:block">
								<div className="border-b border-border/60 p-4">
									<div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Inbox
									</div>
									<div className="mt-1 text-2xl font-semibold tracking-tight">
										12
									</div>
								</div>
								{[
									{ name: "Maya P.", preview: "discount on bundle?", active: true },
									{ name: "Tomás R.", preview: "shipping to Spain", active: false },
									{ name: "Anika S.", preview: "refund timeline", active: false },
									{ name: "Jules B.", preview: "Great, thanks!", active: false },
								].map((c) => (
									<div
										key={c.name}
										className={`border-b border-border/40 px-4 py-3 transition-colors ${
											c.active ? "bg-card" : "hover:bg-card/50"
										}`}
									>
										<div className="flex items-center justify-between">
											<div className="text-sm font-medium">{c.name}</div>
											{c.active && (
												<span className="h-1.5 w-1.5 rounded-full bg-foreground" />
											)}
										</div>
										<div className="mt-0.5 truncate text-xs text-muted-foreground">
											{c.preview}
										</div>
									</div>
								))}
							</div>

							{/* Conversation pane */}
							<div className="flex flex-col bg-background">
								<div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
									<div className="flex items-center gap-3">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
											M
										</div>
										<div>
											<div className="text-sm font-medium">Maya Patel</div>
											<div className="text-xs text-muted-foreground">
												maya@northbeam.co
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
											auto
										</span>
										<button
											type="button"
											className="rounded-full bg-foreground px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
										>
											Take over
										</button>
									</div>
								</div>

								<div className="flex flex-1 flex-col gap-3 px-5 py-6">
									<ChatBubble side="left">
										Hey, do you ship to Canada?
									</ChatBubble>
									<ChatBubble side="right">
										Yes — Canada-wide is $12 flat, 3–5 business days.
									</ChatBubble>
									<ChatBubble side="left">
										Cool. Can I bundle two and get a discount?
									</ChatBubble>
									<ChatBubble side="right" human>
										Hey! Quick yes — bundle of two saves you 15%. Want me to set
										it up?
									</ChatBubble>
								</div>

								<div className="border-t border-border/60 px-5 py-3">
									<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
										<span className="text-sm text-muted-foreground/60">
											Reply as Leadly…
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

function ChatBubble({
	side,
	human,
	children,
}: {
	side: "left" | "right";
	human?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className={`flex ${side === "left" ? "justify-start" : "justify-end"}`}>
			<div
				className={`relative max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
					side === "left"
						? "rounded-bl-sm bg-secondary text-secondary-foreground"
						: "rounded-br-sm bg-foreground text-background"
				}`}
			>
				{children}
				{human && (
					<span className="pointer-events-none absolute -top-2 -right-2 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
						human
					</span>
				)}
			</div>
		</div>
	);
}

function ClosingCta() {
	return (
		<section className="bg-background pb-28 md:pb-36">
			<div className="container mx-auto max-w-4xl px-4">
				<div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center md:px-14 md:py-24">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-foreground)_0%,transparent_60%)] opacity-[0.05]"
					/>
					<div className="relative">
						<h2 className="text-balance text-3xl font-semibold tracking-tighter md:text-5xl">
							Put it on your site this afternoon.
						</h2>
						<p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
							A working agent, a real inbox, and visitors who actually get
							answers — without rebuilding your stack.
						</p>
						<div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
							<Button size="lg" asChild>
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
	);
}
