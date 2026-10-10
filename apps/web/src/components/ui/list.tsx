import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

// Flat, full-width rows: the Linear-style alternative to a stack of cards.
// Rows highlight on hover; pass `asChild` to make the whole row a link.
//
//   <List>
//     <ListItem asChild active={selected}>
//       <Link to="…">
//         <Avatar … />
//         <ListItemContent>
//           <ListItemTitle>…</ListItemTitle>
//           <ListItemDescription>…</ListItemDescription>
//         </ListItemContent>
//         <ListItemMeta>2h</ListItemMeta>
//       </Link>
//     </ListItem>
//   </List>

const listVariants = cva("group/list flex flex-col", {
	variants: {
		variant: {
			// Full-bleed rows that pick up the page gutter.
			default: "py-1",
			// Rows inside padded content (a PageSection): rounded hover, text
			// aligned with the surrounding content.
			inset: "-mx-2",
			// Rows inside a SettingsCard: card padding, hairlines between rows.
			card: "divide-y divide-border/60",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function List({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof listVariants>) {
	return (
		<div
			role="list"
			data-slot="list"
			data-variant={variant}
			className={cn(listVariants({ variant, className }))}
			{...props}
		/>
	);
}

function ListItem({
	className,
	asChild = false,
	active = false,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean; active?: boolean }) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			role="listitem"
			data-slot="list-item"
			data-active={active || undefined}
			className={cn(
				"group/list-item flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm outline-none transition-colors duration-100 md:px-6",
				"hover:bg-accent/60 focus-visible:bg-accent data-[active]:bg-accent",
				"group-data-[variant=inset]/list:rounded-md group-data-[variant=inset]/list:px-2 md:group-data-[variant=inset]/list:px-2",
				"group-data-[variant=card]/list:min-h-16 group-data-[variant=card]/list:px-4 md:group-data-[variant=card]/list:px-5 group-data-[variant=card]/list:hover:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}

function ListItemContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-item-content"
			className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
			{...props}
		/>
	);
}

function ListItemTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-item-title"
			className={cn(
				"flex min-w-0 items-center gap-2 truncate font-medium",
				className,
			)}
			{...props}
		/>
	);
}

function ListItemDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-item-description"
			className={cn(
				"flex min-w-0 items-center gap-2 truncate text-[13px] text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

// Right-hand cluster: timestamps, counts, badges.
function ListItemMeta({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="list-item-meta"
			className={cn(
				"ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums",
				className,
			)}
			{...props}
		/>
	);
}

export {
	listVariants,
	List,
	ListItem,
	ListItemContent,
	ListItemTitle,
	ListItemDescription,
	ListItemMeta,
};
