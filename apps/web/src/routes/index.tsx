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
			<FeaturesSection />
			<ClosingCta />
		</>
	);
}

function Hero() {
	return (
		<section className="relative overflow-hidden bg-background">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[420px] max-w-5xl rounded-full bg-primary/10 blur-3xl"
			/>
			<div className="container relative mx-auto max-w-5xl px-4 pt-20 pb-24 md:pt-28 md:pb-32">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: "easeOut" }}
					className="mx-auto max-w-3xl text-center"
				>
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
						</span>
						Live human takeover, no awkward handoff
					</div>

					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
						AI support that knows{" "}
						<span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
							when to step aside.
						</span>
					</h1>

					<p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
						Leadly answers your visitors instantly. When a real person needs to
						step in, they take over the conversation — same name, same voice,
						no awkward "let me transfer you."
					</p>

					<div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

function ClosingCta() {
	return (
		<section className="bg-background pb-24 md:pb-32">
			<div className="container mx-auto max-w-4xl px-4">
				<div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-14 text-center md:px-14 md:py-20">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent"
					/>
					<div className="relative">
						<h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
							Put it on your site this afternoon.
						</h2>
						<p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
							A working agent, a real inbox, and visitors who actually get
							answers — without rebuilding your stack.
						</p>
						<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
