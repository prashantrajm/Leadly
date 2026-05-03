import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MODELS = [
	"OpenAI",
	"Anthropic",
	"Google",
	"Mistral",
	"Groq",
	"Local",
];

export function ModelsCard() {
	const [active, setActive] = useState(0);

	useEffect(() => {
		const t = setInterval(() => setActive((a) => (a + 1) % MODELS.length), 1400);
		return () => clearInterval(t);
	}, []);

	return (
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg md:p-8">
			<div className="mb-4">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
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
				{MODELS.map((m, i) => (
					<motion.span
						key={m}
						animate={{
							scale: active === i ? 1.05 : 1,
						}}
						transition={{ duration: 0.3 }}
						className={cn(
							"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
							active === i
								? "border-primary/40 bg-primary/10 text-primary"
								: "border-border bg-secondary/30 text-muted-foreground",
						)}
					>
						{m}
					</motion.span>
				))}
			</div>
		</div>
	);
}
