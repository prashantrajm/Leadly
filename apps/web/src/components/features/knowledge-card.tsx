import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ARTICLES = [
	{ title: "Shipping & delivery", score: 0.94 },
	{ title: "Returns policy", score: 0.41 },
	{ title: "International orders", score: 0.88 },
	{ title: "Bundles & discounts", score: 0.36 },
	{ title: "Account settings", score: 0.22 },
];

const MATCH_INDICES = new Set([0, 2]);

export function KnowledgeCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });
	const [revealed, setRevealed] = useState(0);

	useEffect(() => {
		if (!inView) return;
		if (revealed >= ARTICLES.length) return;
		const t = setTimeout(() => setRevealed((r) => r + 1), 140);
		return () => clearTimeout(t);
	}, [inView, revealed]);

	return (
		<div
			ref={ref}
			className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="relative z-10 flex h-full flex-col">
				<div className="mb-5 max-w-md">
					<div className="mb-2 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						<span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
						Knowledge base
					</div>
					<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
						Grounded in your content. Cited every time.
					</h3>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						Write your KB in Markdown or upload a doc. Leadly retrieves the
						most relevant passages on every turn — and tells the visitor which
						article the answer came from.
					</p>
				</div>

				{/* Visitor question */}
				<motion.div
					initial={{ opacity: 0, y: 6 }}
					animate={inView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.4 }}
					className="mb-3 inline-flex max-w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-3 py-1.5 text-sm text-secondary-foreground"
				>
					Do you ship to Canada?
				</motion.div>

				<div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
					Top matches
				</div>

				<div className="mt-auto flex flex-col gap-1.5">
					{ARTICLES.map((article, i) => {
						const isMatch = MATCH_INDICES.has(i);
						const isVisible = i < revealed;
						return (
							<motion.div
								key={article.title}
								initial={{ opacity: 0, x: -8 }}
								animate={
									isVisible
										? { opacity: isMatch ? 1 : 0.4, x: 0 }
										: { opacity: 0, x: -8 }
								}
								transition={{ duration: 0.3 }}
								className={cn(
									"flex items-center justify-between rounded-lg border px-3 py-2 text-xs md:text-sm",
									isMatch
										? "border-accent-blue/30 bg-accent-blue/5 text-foreground"
										: "border-border bg-secondary/20 text-muted-foreground",
								)}
							>
								<span className="truncate">{article.title}</span>
								{isMatch && isVisible && (
									<motion.span
										initial={{ scale: 0.6, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.2 }}
										className="ml-3 shrink-0 rounded-full bg-accent-blue px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] text-accent-blue-foreground"
									>
										{article.score.toFixed(2)}
									</motion.span>
								)}
							</motion.div>
						);
					})}
				</div>
			</div>

			<div
				aria-hidden
				className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-foreground/[0.04] blur-3xl"
			/>
		</div>
	);
}
