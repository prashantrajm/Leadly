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
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="mb-3">
				<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Your model
				</div>
				<h3 className="text-lg font-semibold tracking-tight md:text-xl">
					Pick the model. Switch anytime.
				</h3>
				<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
					OpenAI, Anthropic, Google, Mistral — or run your own.
				</p>
			</div>

			<div className="mt-auto flex flex-wrap gap-1.5">
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
								"rounded-full border px-2.5 py-1 text-[11px] font-medium",
								isActive
									? "border-accent-blue bg-accent-blue text-accent-blue-foreground"
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
