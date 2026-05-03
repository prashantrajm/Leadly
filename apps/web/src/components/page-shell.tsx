import type { ReactNode } from "react";

export function PageShell({
	eyebrow,
	title,
	description,
	children,
}: {
	eyebrow: string;
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-20 md:py-28">
			<header className="mb-14 border-b border-border/60 pb-10">
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					{eyebrow}
				</p>
				<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-5xl">
					{title}
				</h1>
				{description && (
					<p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
						{description}
					</p>
				)}
			</header>
			<div className="space-y-12 text-foreground">{children}</div>
		</div>
	);
}

export function Section({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-4">
			<h2 className="text-xl font-semibold tracking-tight md:text-2xl">
				{title}
			</h2>
			<div className="space-y-3 leading-relaxed text-muted-foreground">
				{children}
			</div>
		</section>
	);
}
