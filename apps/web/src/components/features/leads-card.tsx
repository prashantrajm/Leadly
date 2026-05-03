import { Mail, User } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

export function LeadsCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 md:p-8"
		>
			<div className="mb-5">
				<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Lead capture
				</div>
				<h3 className="text-xl font-semibold tracking-tight">
					Captures contacts inside the conversation.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					No pop-up form. The agent asks naturally, then the lead lands in
					your inbox.
				</p>
			</div>

			<div className="mt-auto">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={inView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.45, ease: "easeOut", delay: 0.2 }}
					className="rounded-xl border border-border bg-secondary/30 p-4"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground">
							<User className="h-4 w-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium text-foreground">
								Maya Patel
							</div>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Mail className="h-3 w-3" />
								<span className="truncate">maya@northbeam.co</span>
							</div>
						</div>
						<motion.span
							initial={{ scale: 0.6, opacity: 0 }}
							animate={inView ? { scale: 1, opacity: 1 } : {}}
							transition={{ delay: 0.5 }}
							className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground"
						>
							New
						</motion.span>
					</div>
				</motion.div>
			</div>
		</div>
	);
}
