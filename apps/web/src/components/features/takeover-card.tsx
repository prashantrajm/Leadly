import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Turn = {
	id: number;
	from: "visitor" | "agent";
	text: string;
	by: "ai" | "human";
};

const SCRIPT: Turn[] = [
	{
		id: 1,
		from: "visitor",
		text: "Can I bundle two and save?",
		by: "ai",
	},
	{
		id: 2,
		from: "agent",
		text: "Quick yes — bundle of two saves you 15%. Want me to set it up?",
		by: "human",
	},
];

export function TakeoverCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });
	const [step, setStep] = useState(0);

	useEffect(() => {
		if (!inView) return;
		if (step >= SCRIPT.length) return;
		const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 400 : 900);
		return () => clearTimeout(t);
	}, [inView, step]);

	const visible = SCRIPT.slice(0, step);

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="mb-4">
				<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Takeover
				</div>
				<h3 className="text-lg font-semibold tracking-tight md:text-xl">
					Step in when you want to.
				</h3>
				<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
					Your reply renders under the agent's name. The visitor sees one
					continuous conversation.
				</p>
			</div>

			<div className="relative mt-auto flex flex-col justify-end gap-2">
				<AnimatePresence initial={false}>
					{visible.map((turn) => (
						<motion.div
							key={turn.id}
							initial={{ opacity: 0, y: 8, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.35, ease: "easeOut" }}
							className={cn(
								"flex w-full",
								turn.from === "visitor" ? "justify-start" : "justify-end",
							)}
						>
							<div
								className={cn(
									"relative max-w-[85%] rounded-2xl px-3 py-2 text-xs md:text-sm",
									turn.from === "visitor"
										? "rounded-bl-sm bg-secondary text-secondary-foreground"
										: "rounded-br-sm bg-foreground text-background",
								)}
							>
								{turn.text}
								{turn.from === "agent" && turn.by === "human" && (
									<motion.span
										initial={{ opacity: 0, scale: 0.6 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: 0.2 }}
										className="pointer-events-none absolute -top-2 -right-2 rounded-full bg-accent-blue px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-accent-blue-foreground"
										title="Visitor sees no difference. Only your dashboard knows."
									>
										you
									</motion.span>
								)}
							</div>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</div>
	);
}
