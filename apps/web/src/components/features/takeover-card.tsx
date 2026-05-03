import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
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
	const [step, setStep] = useState(0);

	useEffect(() => {
		const t = setInterval(() => {
			setStep((s) => (s + 1) % (SCRIPT.length + 1));
		}, 2400);
		return () => clearInterval(t);
	}, []);

	const visible = SCRIPT.slice(0, step);

	return (
		<div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg md:p-8">
			<div className="relative z-10 flex h-full flex-col">
				<div className="mb-6 max-w-md">
					<div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
						</span>
						Live takeover
					</div>
					<h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
						Same name. Same voice.
					</h3>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
						The AI handles the conversation. When you step in, the visitor sees
						no break — no "transferring you to Sarah," no awkward handoff.
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
										"relative max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
										turn.from === "visitor"
											? "rounded-bl-sm bg-secondary text-secondary-foreground"
											: "rounded-br-sm bg-primary text-primary-foreground",
									)}
								>
									{turn.text}
									{turn.from === "agent" && turn.by === "human" && (
										<motion.span
											initial={{ opacity: 0, scale: 0.6 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ delay: 0.2 }}
											className="pointer-events-none absolute -top-2 -right-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary shadow-sm ring-1 ring-border"
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
				className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
			/>
		</div>
	);
}
