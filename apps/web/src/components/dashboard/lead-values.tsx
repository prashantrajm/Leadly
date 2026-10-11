import type { KeyFact, Lead, LeadField } from "@leadly/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { SpinnerIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
	customFieldsPatch,
	fieldValues,
	labeledValues,
} from "@/lib/lead-fields";

// Captured lead field values: read-only lists, controlled inputs, and a
// self-saving editor for places outside a larger form.

// Captured values, read-only, labeled by the agent's fields.
export function LeadValuesList({
	fields,
	details,
}: {
	fields: LeadField[];
	details: Record<string, unknown>;
}) {
	const rows = labeledValues(fields, details);
	if (rows.length === 0) return null;
	return (
		<dl className="space-y-2.5 text-[13px]">
			{rows.map((row) => (
				<div key={row.key}>
					<dt className="text-muted-foreground">{row.label}</dt>
					<dd className="mt-0.5 text-foreground">{row.value}</dd>
				</div>
			))}
		</dl>
	);
}

// Controlled inputs, one per field. An empty string means "cleared".
export function LeadValueInputs({
	fields,
	values,
	onChange,
}: {
	fields: LeadField[];
	values: Record<string, string>;
	onChange: (key: string, value: string) => void;
}) {
	const id = useId();
	if (fields.length === 0) return null;
	return (
		<div className="space-y-4">
			{fields.map((f) => (
				<div key={f.key} className="space-y-1.5">
					<Label htmlFor={`${id}-${f.key}`}>{f.label}</Label>
					<LeadFieldInput
						id={`${id}-${f.key}`}
						field={f}
						value={values[f.key] ?? ""}
						onChange={(v) => onChange(f.key, v)}
					/>
				</div>
			))}
		</div>
	);
}

const CLEAR = "__clear__";

function LeadFieldInput({
	id,
	field,
	value,
	onChange,
}: {
	id: string;
	field: LeadField;
	value: string;
	onChange: (value: string) => void;
}) {
	const options =
		field.type === "yes_no"
			? ["Yes", "No"]
			: field.type === "choice"
				? (field.options ?? [])
				: null;
	if (!options) {
		return (
			<Input
				id={id}
				value={value}
				inputMode={field.type === "number" ? "decimal" : undefined}
				placeholder="—"
				onChange={(e) => onChange(e.target.value)}
			/>
		);
	}
	// The agent keeps off-list answers as written; show them as an option
	// rather than hiding the value.
	const all = value && !options.includes(value) ? [...options, value] : options;
	return (
		<Select
			value={value || CLEAR}
			onValueChange={(v) => onChange(v === CLEAR ? "" : v)}
		>
			<SelectTrigger id={id} className="w-full">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={CLEAR}>—</SelectItem>
				{all.map((o) => (
					<SelectItem key={o} value={o}>
						{o}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// Notable details outside the configured fields. Pass onRemove to let a
// teammate drop one that's wrong or stale.
export function KeyFactsList({
	facts,
	onRemove,
}: {
	facts: KeyFact[];
	onRemove?: (index: number) => void;
}) {
	if (facts.length === 0) return null;
	return (
		<dl className="space-y-2.5 text-[13px]">
			{facts.map((fact, i) => (
				<div
					key={`${fact.label}-${fact.value}`}
					className="flex items-start gap-2"
				>
					<div className="min-w-0 flex-1">
						<dt className="text-muted-foreground">{fact.label}</dt>
						<dd className="mt-0.5 text-foreground">{fact.value}</dd>
					</div>
					{onRemove && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-6"
							aria-label={`Remove ${fact.label}`}
							onClick={() => onRemove(i)}
						>
							<XIcon className="size-3.5" />
						</Button>
					)}
				</div>
			))}
		</dl>
	);
}

// Edits a lead's field values in place and saves them on its own.
export function LeadValuesEditor({
	lead,
	fields,
}: {
	lead: Lead;
	fields: LeadField[];
}) {
	const queryClient = useQueryClient();
	const initial = fieldValues(fields, lead.customFields);
	const [values, setValues] = useState(initial);
	useEffect(() => {
		setValues(fieldValues(fields, lead.customFields));
	}, [fields, lead]);
	const dirty = fields.some(
		(f) => (values[f.key] ?? "").trim() !== (initial[f.key] ?? ""),
	);

	const save = useMutation({
		mutationFn: () =>
			api.leads.update(lead.id, {
				customFields: customFieldsPatch(lead.customFields, values),
			}),
		onSuccess: (updated) => {
			queryClient.setQueryData(["lead", lead.id], updated);
			queryClient.invalidateQueries({ queryKey: ["leads"] });
		},
	});

	return (
		<div className="space-y-3">
			<LeadValueInputs
				fields={fields}
				values={values}
				onChange={(key, value) =>
					setValues((prev) => ({ ...prev, [key]: value }))
				}
			/>
			{save.isError && (
				<p className="text-xs text-destructive">Could not save. Try again.</p>
			)}
			{dirty && (
				<div className="flex justify-end gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setValues(initial)}
						disabled={save.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="accent"
						size="sm"
						onClick={() => save.mutate()}
						disabled={save.isPending}
					>
						{save.isPending && <SpinnerIcon className="animate-spin" />}
						Save
					</Button>
				</div>
			)}
		</div>
	);
}
