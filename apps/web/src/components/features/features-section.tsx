import { Badge } from "@/components/ui/badge";
import { HandoffCard } from "./handoff-card";
import { InstallCard } from "./install-card";
import { KnowledgeCard } from "./knowledge-card";
import { LeadsCard } from "./leads-card";
import { ModelsCard } from "./models-card";
import { TakeoverCard } from "./takeover-card";

export function FeaturesSection() {
	return (
		<section id="features" className="bg-background py-16 md:py-20">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
					<Badge variant="outline" className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em]">
						Features
					</Badge>
					<h2 className="text-balance text-3xl font-semibold tracking-tighter md:text-5xl">
						Everything one conversation needs.
					</h2>
					<p className="mt-4 text-pretty text-base text-muted-foreground md:text-lg">
						An agent your visitors actually want to talk to. An inbox you
						actually want to open.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-4">
					{/* Row 1 — hero knowledge (4 cols) + install (2 cols) */}
					<div className="md:col-span-4 md:row-span-2">
						<KnowledgeCard />
					</div>
					<div className="md:col-span-2">
						<InstallCard />
					</div>

					{/* Row 2 right — models (2 cols) */}
					<div className="md:col-span-2">
						<ModelsCard />
					</div>

					{/* Row 3 — takeover (3 cols) + leads (3 cols) */}
					<div className="md:col-span-3">
						<TakeoverCard />
					</div>
					<div className="md:col-span-3">
						<LeadsCard />
					</div>

					{/* Row 4 — handoff (full width, shorter) */}
					<div className="md:col-span-6">
						<HandoffCard />
					</div>
				</div>
			</div>
		</section>
	);
}
