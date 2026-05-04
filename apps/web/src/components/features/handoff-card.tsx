import { motion, useInView } from "motion/react";
import { useRef } from "react";

export function HandoffCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="mb-3">
				<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Handoff
				</div>
				<h3 className="text-lg font-semibold tracking-tight md:text-xl">
					Pings you when it matters.
				</h3>
				<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
					Escalations land in your inbox, ready to take over.
				</p>
			</div>

			<div className="relative mt-auto flex h-20 items-center justify-center">
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
							className="absolute h-12 w-12 rounded-full border border-accent-blue/40"
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
							className="absolute h-16 w-16 rounded-full border border-accent-blue/25"
						/>
					</>
				)}

				<motion.div
					initial={{ scale: 0.7, opacity: 0 }}
					animate={inView ? { scale: 1, opacity: 1 } : {}}
					transition={{ duration: 0.4, ease: "easeOut" }}
					className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue text-accent-blue-foreground shadow-lg shadow-accent-blue/20"
				>
					<svg
						className="h-5 w-5"
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
