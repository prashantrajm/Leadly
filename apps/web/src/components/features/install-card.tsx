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
		<div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:border-border/80 md:p-8">
			<div className="mb-4">
				<div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Install
				</div>
				<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
					One script. You're live.
				</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					Drop it in your &lt;head&gt;. The widget appears the moment the page
					loads. No SDK, no build step.
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
					<pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground/90">
						<code>{SNIPPET}</code>
					</pre>
				</motion.div>
			</div>
		</div>
	);
}
