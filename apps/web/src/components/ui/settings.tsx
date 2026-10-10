import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Linear-style settings group: one raised card, one row per setting, label
// and description on the left, the control on the right, hairlines between.
//
//   <PageSection variant="grouped">
//     <PageSectionHeader><PageSectionTitle>General</PageSectionTitle></PageSectionHeader>
//     <SettingsCard>
//       <SettingsRow>
//         <SettingsRowLabel>
//           <SettingsRowTitle>Name</SettingsRowTitle>
//           <SettingsRowDescription>Shown in the sidebar.</SettingsRowDescription>
//         </SettingsRowLabel>
//         <SettingsRowControl><Input /></SettingsRowControl>
//       </SettingsRow>
//       <SettingsCardFooter><Button>Save</Button></SettingsCardFooter>
//     </SettingsCard>
//   </PageSection>
//
// With react-hook-form: <FormItem asChild><SettingsRow>…</SettingsRow></FormItem>
// and <SettingsRowTitle asChild><FormLabel>…</FormLabel></SettingsRowTitle>.

function SettingsCard({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="settings-card"
			className={cn(
				cardVariants(),
				"gap-0 divide-y divide-border/60 overflow-hidden rounded-xl py-0",
				className,
			)}
			{...props}
		/>
	);
}

function SettingsRow({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			data-slot="settings-row"
			className={cn(
				"flex min-h-16 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 md:px-5",
				className,
			)}
			{...props}
		/>
	);
}

function SettingsRowLabel({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="settings-row-label"
			className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
			{...props}
		/>
	);
}

function SettingsRowTitle({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			data-slot="settings-row-title"
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

function SettingsRowDescription({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"p"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "p";
	return (
		<Comp
			data-slot="settings-row-description"
			className={cn(
				"text-[13px] leading-relaxed text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

// Right-hand side. Inputs and selects inside fill a fixed column so rows line
// up; buttons and switches keep their natural width.
function SettingsRowControl({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="settings-row-control"
			className={cn(
				"flex shrink-0 flex-col gap-1.5 sm:items-end",
				"[&_[data-slot=input]]:w-full sm:[&_[data-slot=input]]:w-64 [&_[data-slot=select-trigger]]:w-full sm:[&_[data-slot=select-trigger]]:w-64",
				className,
			)}
			{...props}
		/>
	);
}

// Muted strip at the bottom of a card for its Save / Cancel actions.
function SettingsCardFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="settings-card-footer"
			className={cn(
				"flex items-center justify-end gap-3 bg-muted/50 px-4 py-3 md:px-5",
				className,
			)}
			{...props}
		/>
	);
}

export {
	SettingsCard,
	SettingsRow,
	SettingsRowLabel,
	SettingsRowTitle,
	SettingsRowDescription,
	SettingsRowControl,
	SettingsCardFooter,
};
