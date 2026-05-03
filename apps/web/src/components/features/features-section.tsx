import { Badge } from "@/components/ui/badge";
import { HandoffCard } from "./handoff-card";
import { InstallCard } from "./install-card";
import { KnowledgeCard } from "./knowledge-card";
import { LeadsCard } from "./leads-card";
import { ModelsCard } from "./models-card";
import { TakeoverCard } from "./takeover-card";

export function FeaturesSection() {
	return (
		<section id="features" className="bg-background py-20 md:py-28">
			<div className="container mx-auto max-w-7xl px-4">
				<div className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
					<Badge variant="secondary" className="mb-4">
						Features
					</Badge>
					<h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
						Everything one conversation needs.
					</h2>
					<p className="mt-4 text-base text-muted-foreground md:text-lg">
						An agent your visitors actually want to talk to. An inbox you
						actually want to open.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
					{/* Row 1 — hero takeover (4 cols) + install (2 cols) */}
					<div className="md:col-span-4 md:row-span-2">
						<TakeoverCard />
					</div>
					<div className="md:col-span-2">
						<InstallCard />
					</div>

					{/* Row 2 right — models (2 cols) */}
					<div className="md:col-span-2">
						<ModelsCard />
					</div>

					{/* Row 3 — knowledge (3 cols) + leads (3 cols) */}
					<div className="md:col-span-3">
						<KnowledgeCard />
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
