import { motion, useInView } from "motion/react";
import { useRef } from "react";

export function HandoffCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 md:p-8"
		>
			<div className="mb-4">
				<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Handoff
				</div>
				<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
					Pings you when it matters.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					The agent escalates only when it should. You see the conversation
					in your inbox, ready to take over.
				</p>
			</div>

			<div className="relative mt-auto flex h-32 items-center justify-center">
				{inView && (
					<>
						<motion.div
							initial={{ scale: 0.6, opacity: 0 }}
							animate={{ scale: 2.6, opacity: 0 }}
							transition={{
								duration: 1.8,
								ease: "easeOut",
								repeat: 2,
								repeatDelay: 0.4,
							}}
							className="absolute h-16 w-16 rounded-full border border-foreground/30"
						/>
						<motion.div
							initial={{ scale: 0.7, opacity: 0 }}
							animate={{ scale: 2, opacity: 0 }}
							transition={{
								duration: 1.8,
								ease: "easeOut",
								delay: 0.4,
								repeat: 2,
								repeatDelay: 0.4,
							}}
							className="absolute h-16 w-16 rounded-full border border-foreground/20"
						/>
					</>
				)}

				<motion.div
					initial={{ scale: 0.7, opacity: 0 }}
					animate={inView ? { scale: 1, opacity: 1 } : {}}
					transition={{ duration: 0.4, ease: "easeOut" }}
					className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
				>
					<svg
						className="h-7 w-7"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden
					>
						<title>Inbox</title>
						<path d="M22 12h-6l-2 3h-4l-2-3H2" />
						<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
					</svg>
				</motion.div>
			</div>
		</div>
	);
}
