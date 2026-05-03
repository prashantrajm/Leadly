import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function HandoffCard() {
	const [pulse, setPulse] = useState(0);

	useEffect(() => {
		const t = setInterval(() => setPulse((p) => p + 1), 2600);
		return () => clearInterval(t);
	}, []);

	return (
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg md:p-8">
			<div className="mb-4">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
					Handoff
				</div>
				<h3 className="text-xl font-semibold tracking-tight">
					Pings you when it matters.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					The agent escalates only when it should. You see the conversation
					in your inbox, ready to take over.
				</p>
			</div>

			<div className="relative mt-auto flex h-28 items-center justify-center">
				<motion.div
					key={pulse}
					initial={{ scale: 0.6, opacity: 0 }}
					animate={{ scale: 2.4, opacity: 0 }}
					transition={{ duration: 1.6, ease: "easeOut" }}
					className="absolute h-16 w-16 rounded-full border-2 border-primary/40"
				/>
				<motion.div
					key={`b-${pulse}`}
					initial={{ scale: 0.7, opacity: 0 }}
					animate={{ scale: 1.8, opacity: 0 }}
					transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
					className="absolute h-16 w-16 rounded-full border-2 border-primary/30"
				/>

				<div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
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
				</div>
			</div>
		</div>
	);
}
