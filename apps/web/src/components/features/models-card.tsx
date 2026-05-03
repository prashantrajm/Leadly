import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MODELS = ["OpenAI", "Anthropic", "Google", "Mistral", "Groq", "Local"];

export function ModelsCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });
	const [revealed, setRevealed] = useState(0);

	useEffect(() => {
		if (!inView) return;
		if (revealed >= MODELS.length) return;
		const t = setTimeout(() => setRevealed((r) => r + 1), 90);
		return () => clearTimeout(t);
	}, [inView, revealed]);

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 md:p-8"
		>
			<div className="mb-4">
				<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Your model
				</div>
				<h3 className="text-xl font-semibold tracking-tight">
					Pick the model. Switch anytime.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					OpenAI, Anthropic, Google, Mistral — or run your own. Per-agent.
				</p>
			</div>

			<div className="mt-auto flex flex-wrap gap-2">
				{MODELS.map((m, i) => {
					const isVisible = i < revealed;
					const isActive = i === 0; // OpenAI as the visually-active default
					return (
						<motion.span
							key={m}
							initial={{ opacity: 0, y: 4 }}
							animate={isVisible ? { opacity: 1, y: 0 } : {}}
							transition={{ duration: 0.25 }}
							className={cn(
								"rounded-full border px-3 py-1.5 text-xs font-medium",
								isActive
									? "border-foreground/30 bg-foreground text-background"
									: "border-border bg-secondary/30 text-muted-foreground",
							)}
						>
							{m}
						</motion.span>
					);
				})}
			</div>
		</div>
	);
}
