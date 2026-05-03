import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const SNIPPET = `<script
  src="https://cdn.leadly.app/loader.js"
  data-agent-id="ag_8f2c"
  defer
></script>`;

export function InstallCard() {
	const [copied, setCopied] = useState(false);

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(SNIPPET);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			/* noop */
		}
	};

	return (
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 md:p-6">
			<div className="mb-3">
				<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Install
				</div>
				<h3 className="text-lg font-semibold tracking-tight md:text-xl">
					One script. You're live.
				</h3>
				<p className="mt-1.5 text-xs leading-relaxed text-muted-foreground md:text-sm">
					Drop it in your &lt;head&gt;. No SDK, no build step.
				</p>
			</div>

			<div className="relative mt-auto">
				<motion.div
					whileHover={{ y: -2 }}
					transition={{ duration: 0.2 }}
					className="overflow-hidden rounded-lg border border-border bg-secondary/40"
				>
					<div className="flex items-center justify-between border-b border-border px-3 py-2">
						<div className="flex items-center gap-1.5">
							<span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
							<span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
							<span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
						</div>
						<button
							type="button"
							onClick={onCopy}
							className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
						>
							{copied ? (
								<>
									<Check className="h-3.5 w-3.5" />
									Copied
								</>
							) : (
								<>
									<Copy className="h-3.5 w-3.5" />
									Copy
								</>
							)}
						</button>
					</div>
					<pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground/90">
						<code>{SNIPPET}</code>
					</pre>
				</motion.div>
			</div>
		</div>
	);
}
