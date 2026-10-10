import { MailIcon, UserIcon } from "@/components/icons";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

export function LeadsCard() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<div
			ref={ref}
			className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6"
		>
			<div className="mb-4">
				<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Lead capture
				</div>
				<h3 className="text-lg font-semibold tracking-tight md:text-xl">
					Captured inside the conversation.
				</h3>
				<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
					No pop-up form. The agent asks naturally; leads land in your inbox.
				</p>
			</div>

			<div className="mt-auto">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={inView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.45, ease: "easeOut", delay: 0.2 }}
					className="rounded-xl border border-border bg-secondary/30 p-3"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground">
							<UserIcon className="h-3.5 w-3.5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium text-foreground">
								Maya Patel
							</div>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<MailIcon className="h-3 w-3" />
								<span className="truncate">maya@northbeam.co</span>
							</div>
						</div>
						<motion.span
							initial={{ scale: 0.6, opacity: 0 }}
							animate={inView ? { scale: 1, opacity: 1 } : {}}
							transition={{ delay: 0.5 }}
							className="shrink-0 rounded-full bg-accent-blue px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent-blue-foreground"
						>
							New
						</motion.span>
					</div>
				</motion.div>
			</div>
		</div>
	);
}
