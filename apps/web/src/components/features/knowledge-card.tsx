import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ARTICLES = [
	"Shipping & delivery",
	"Returns policy",
	"International orders",
	"Bundles & discounts",
	"Account settings",
];

// indices of "matched" articles per cycle step
const MATCHES: number[][] = [
	[0, 2],
	[1],
	[3, 0],
	[4],
];

export function KnowledgeCard() {
	const [step, setStep] = useState(0);

	useEffect(() => {
		const t = setInterval(() => setStep((s) => (s + 1) % MATCHES.length), 2200);
		return () => clearInterval(t);
	}, []);

	const matched = new Set(MATCHES[step]);

	return (
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg md:p-8">
			<div className="mb-5">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
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
				{ARTICLES.map((title, i) => {
					const isMatch = matched.has(i);
					return (
						<motion.div
							key={title}
							animate={{
								opacity: isMatch ? 1 : 0.45,
								x: isMatch ? 0 : -2,
							}}
							transition={{ duration: 0.4 }}
							className={cn(
								"flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
								isMatch
									? "border-primary/30 bg-primary/5 text-foreground"
									: "border-border bg-secondary/30 text-muted-foreground",
							)}
						>
							<span className="truncate">{title}</span>
							{isMatch && (
								<motion.span
									initial={{ scale: 0.6, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									className="ml-3 shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary"
								>
									0.9{Math.floor(Math.random() * 9)}
								</motion.span>
							)}
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
