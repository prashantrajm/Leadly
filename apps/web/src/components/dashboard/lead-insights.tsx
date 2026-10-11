import type { LeadIntent } from "@leadly/schemas";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Post-chat analysis bits shared by the leads list and the inbox.

export const INTENT_LABEL: Record<LeadIntent, string> = {
	buying: "Buying",
	pricing: "Pricing",
	demo: "Demo",
	support: "Support",
	partnership: "Partnership",
	job: "Job",
	browsing: "Browsing",
	other: "Other",
};

export function IntentBadge({ intent }: { intent: LeadIntent | null }) {
	if (!intent) return <span className="text-muted-foreground">—</span>;
	return <Badge variant="secondary">{INTENT_LABEL[intent]}</Badge>;
}

// 0–100 lead score, bucketed so a list scans at a glance.
export function scoreTier(score: number): "hot" | "warm" | "cold" {
	if (score >= 70) return "hot";
	if (score >= 40) return "warm";
	return "cold";
}

const TIER_CLASS = {
	hot: "bg-red-500/10 text-red-600 dark:text-red-400",
	warm: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	cold: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
} as const;

export function ScoreBadge({ score }: { score: number | null }) {
	if (score === null) return <span className="text-muted-foreground">—</span>;
	const tier = scoreTier(score);
	return (
		<Badge
			variant="secondary"
			className={cn("font-mono tabular-nums", TIER_CLASS[tier])}
		>
			{score} · {tier}
		</Badge>
	);
}
