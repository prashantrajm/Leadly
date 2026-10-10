import type { IconComponent } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Stat,
	StatDescription,
	StatLabel,
	StatValue,
} from "@/components/ui/stat";
import { cn } from "@/lib/utils";

// One dashboard metric. Place inside a <StatGroup>.
export function Kpi({
	label,
	value,
	sub,
	icon: Icon,
	accent,
	loading,
}: {
	label: string;
	value: number | undefined;
	sub?: string;
	icon?: IconComponent;
	accent?: boolean;
	loading?: boolean;
}) {
	return (
		<Stat>
			<StatLabel>
				{label}
				{Icon && <Icon className={cn(accent && "text-accent-blue")} />}
			</StatLabel>
			<StatValue>
				{loading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					(value ?? 0).toLocaleString()
				)}
			</StatValue>
			{sub && <StatDescription>{sub}</StatDescription>}
		</Stat>
	);
}
