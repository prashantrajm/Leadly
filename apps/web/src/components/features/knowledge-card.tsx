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
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 md:p-8"
		>
			<div className="mb-5">
				<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Knowledge base
				</div>
				<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
					Answers grounded in your content.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					Write your KB in Markdown, upload a doc, or paste it in. Leadly
					retrieves the right passage — and cites it.
				</p>
			</div>

			<div className="mt-auto flex flex-col gap-2">
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
								"flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
								isMatch
									? "border-foreground/20 bg-secondary/60 text-foreground"
									: "border-border bg-secondary/20 text-muted-foreground",
							)}
						>
							<span className="truncate">{article.title}</span>
							{isMatch && isVisible && (
								<motion.span
									initial={{ scale: 0.6, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ delay: 0.2 }}
									className="ml-3 shrink-0 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] text-foreground"
								>
									{article.score.toFixed(2)}
								</motion.span>
							)}
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
