import { Mail, User } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function LeadsCard() {
	const [tick, setTick] = useState(0);

	useEffect(() => {
		const t = setInterval(() => setTick((x) => x + 1), 3200);
		return () => clearInterval(t);
	}, []);

	return (
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg md:p-8">
			<div className="mb-5">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
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
					key={tick}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className="rounded-xl border border-border bg-secondary/30 p-4"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
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
							animate={{ scale: 1, opacity: 1 }}
							transition={{ delay: 0.15 }}
							className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
						>
							New
						</motion.span>
					</div>
				</motion.div>
			</div>
		</div>
	);
}
