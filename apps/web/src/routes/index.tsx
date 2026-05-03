import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
			<div className="max-w-2xl text-center space-y-8">
				<h1 className="text-4xl md:text-6xl font-bold tracking-tight">
					Leadly
				</h1>
				<p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
					Open-source AI support platform. An embeddable chat widget with
					knowledge base, retrieval, lead capture, and a live human-takeover
					inbox. Voice arrives in v2.
				</p>
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Button size="lg" asChild>
						<Link to="/auth">
							Get started
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
					<Button size="lg" variant="outline" asChild>
						<a
							href="https://github.com"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</Button>
				</div>
			</div>
		</main>
	);
}
