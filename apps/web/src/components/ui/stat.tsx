import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

// Numbers shown side by side, divided by hairlines instead of boxed in
// cards.
//
//   <StatGroup variant="strip">
//     <Stat>
//       <StatLabel>Conversations <MessageIcon /></StatLabel>
//       <StatValue>1,204</StatValue>
//       <StatDescription>last 7 days</StatDescription>
//     </Stat>
//   </StatGroup>

const statGroupVariants = cva("grid", {
	variants: {
		variant: {
			// Full-width band across the top of a page: 2 up on small screens,
			// 4 up on large, ruled off from the content below.
			strip: [
				"grid-cols-2 border-b border-border/60 lg:grid-cols-4",
				"*:border-border/60 *:px-4 *:py-5 md:*:px-6",
				"*:odd:border-r max-lg:*:nth-[-n+2]:border-b lg:*:border-r lg:*:last:border-r-0",
			],
			// Inline row inside a section, aligned to the section's left edge.
			inline:
				"auto-cols-fr grid-flow-col divide-x divide-border/60 *:px-4 *:first:pl-0",
		},
	},
	defaultVariants: {
		variant: "strip",
	},
});

function StatGroup({
	className,
	variant = "strip",
	...props
}: React.ComponentProps<"dl"> & VariantProps<typeof statGroupVariants>) {
	return (
		<dl
			data-slot="stat-group"
			data-variant={variant}
			className={cn(statGroupVariants({ variant, className }))}
			{...props}
		/>
	);
}

function Stat({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="stat"
			className={cn("flex min-w-0 flex-col gap-1.5", className)}
			{...props}
		/>
	);
}

function StatLabel({ className, ...props }: React.ComponentProps<"dt">) {
	return (
		<dt
			data-slot="stat-label"
			className={cn(
				"flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function StatValue({ className, ...props }: React.ComponentProps<"dd">) {
	return (
		<dd
			data-slot="stat-value"
			className={cn(
				"text-2xl font-semibold tracking-tight tabular-nums",
				className,
			)}
			{...props}
		/>
	);
}

function StatDescription({ className, ...props }: React.ComponentProps<"dd">) {
	return (
		<dd
			data-slot="stat-description"
			className={cn("text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	StatGroup,
	Stat,
	StatLabel,
	StatValue,
	StatDescription,
	statGroupVariants,
};
