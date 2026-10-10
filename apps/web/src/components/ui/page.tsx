import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

// Page layout for the dashboard content panel. The panel itself is the
// surface: content runs edge to edge, rows and sections are divided by
// hairlines, and cards are kept for things that are genuinely objects.
//
//   <Page>
//     <PageToolbar>
//       …filters…
//       <PageActions>…buttons…</PageActions>
//     </PageToolbar>
//     <PageContent>…</PageContent>
//   </Page>

function Page({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page"
			className={cn("flex min-h-0 flex-1 flex-col", className)}
			{...props}
		/>
	);
}

// Row under the top bar for filters and page actions.
function PageToolbar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-toolbar"
			className={cn(
				"flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2 md:px-6",
				className,
			)}
			{...props}
		/>
	);
}

// Right-aligned group inside a PageToolbar.
function PageActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-actions"
			className={cn("ml-auto flex items-center gap-1.5", className)}
			{...props}
		/>
	);
}

const pageContentVariants = cva("w-full", {
	variants: {
		width: {
			// Full panel width with the standard gutter.
			default: "px-4 py-6 md:px-6",
			// Reading/form width: settings, editors, detail pages.
			narrow: "mx-auto max-w-3xl px-4 py-8 md:px-6",
			// No gutter: lists and split views that run edge to edge.
			flush: "flex min-h-0 flex-1 flex-col",
		},
	},
	defaultVariants: {
		width: "default",
	},
});

function PageContent({
	className,
	width = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof pageContentVariants>) {
	return (
		<div
			data-slot="page-content"
			data-width={width}
			className={cn(pageContentVariants({ width, className }))}
			{...props}
		/>
	);
}

// A titled block of a page: title (and optional actions) above the content.
//   divided — sections separated by hairlines (detail and overview pages)
//   grouped — sections separated by space; each holds its own card
//             (settings pages, see settings.tsx)
const pageSectionVariants = cva("flex flex-col gap-4", {
	variants: {
		variant: {
			divided:
				"border-b border-border/60 py-8 first:pt-0 last:border-b-0 last:pb-0",
			grouped: "not-first:mt-10",
		},
	},
	defaultVariants: {
		variant: "divided",
	},
});

function PageSection({
	className,
	variant = "divided",
	...props
}: React.ComponentProps<"section"> & VariantProps<typeof pageSectionVariants>) {
	return (
		<section
			data-slot="page-section"
			data-variant={variant}
			className={cn(pageSectionVariants({ variant, className }))}
			{...props}
		/>
	);
}

function PageSectionHeader({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-section-header"
			className={cn(
				"grid auto-rows-min items-start gap-1 has-data-[slot=page-section-actions]:grid-cols-[1fr_auto]",
				className,
			)}
			{...props}
		/>
	);
}

// Buttons beside a section's title, e.g. "Invite member".
function PageSectionActions({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-section-actions"
			className={cn(
				"col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center",
				className,
			)}
			{...props}
		/>
	);
}

function PageSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			data-slot="page-section-title"
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

function PageSectionDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="page-section-description"
			className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}
			{...props}
		/>
	);
}

function PageSectionContent({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-section-content"
			className={cn("flex min-w-0 flex-col gap-4", className)}
			{...props}
		/>
	);
}

export {
	Page,
	PageToolbar,
	PageActions,
	PageContent,
	PageSection,
	PageSectionHeader,
	PageSectionActions,
	PageSectionTitle,
	PageSectionDescription,
	PageSectionContent,
	pageContentVariants,
	pageSectionVariants,
};
