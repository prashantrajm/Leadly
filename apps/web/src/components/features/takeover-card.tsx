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
	{ id: 1, from: "visitor", text: "Hey, do you ship to Canada?", by: "ai" },
	{
		id: 2,
		from: "agent",
		text: "Yes — Canada-wide shipping is $12 flat, 3–5 business days.",
		by: "ai",
	},
	{
		id: 3,
		from: "visitor",
		text: "Cool. Can I bundle two and get a discount?",
		by: "ai",
	},
	{
		id: 4,
		from: "agent",
		text: "Hey! Quick yes — bundle of two saves you 15%. Want me to set it up?",
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
			className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="relative z-10 flex h-full flex-col">
				<div className="mb-4 max-w-md">
					<div className="mb-2 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
							<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
						</span>
						Live takeover
					</div>
					<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
						Same name. Same voice.
					</h3>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						The AI handles the conversation. When you step in, the visitor sees
						no break — no awkward handoff.
					</p>
				</div>

				<div className="relative mt-auto flex flex-1 flex-col justify-end gap-3">
					<AnimatePresence initial={false}>
						{visible.map((turn) => (
							<motion.div
								key={turn.id}
								initial={{ opacity: 0, y: 12, scale: 0.96 }}
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
										"relative max-w-[78%] rounded-2xl px-4 py-2.5 text-sm",
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
											className="pointer-events-none absolute -top-2 -right-2 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground"
											title="Visitor sees no difference. Only your dashboard knows."
										>
											human
										</motion.span>
									)}
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>

			<div
				aria-hidden
				className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-foreground/[0.04] blur-3xl"
			/>
		</div>
	);
}
