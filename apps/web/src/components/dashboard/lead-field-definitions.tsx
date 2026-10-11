import { type LeadField, MAX_LEAD_FIELDS } from "@leadly/schemas";
import { useEffect, useId, useState } from "react";
import { PlusIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LEAD_FIELD_TEMPLATES } from "@/lib/lead-field-templates";
import {
	addTemplate,
	fieldKey,
	LEAD_FIELD_TYPE_LABEL,
} from "@/lib/lead-fields";

// Per-row validation messages, in react-hook-form's nested error shape.
export type LeadFieldErrors = Array<
	{ [K in keyof LeadField]?: { message?: string } } | undefined
>;

// The business's own lead fields: what to capture, how, and whether the
// agent asks for it or only listens for it.
export function LeadFieldDefinitionsEditor({
	fields,
	onChange,
	savedKeys,
	errors,
}: {
	fields: LeadField[];
	onChange: (next: LeadField[]) => void;
	// Keys already saved on the agent. Those never change, so captured
	// answers stay attached when a label is renamed; new fields take their
	// key from the label until they're saved.
	savedKeys: ReadonlySet<string>;
	errors?: LeadFieldErrors;
}) {
	const update = (i: number, patch: Partial<LeadField>) => {
		onChange(
			fields.map((f, j) => {
				if (j !== i) return f;
				const next = { ...f, ...patch };
				if (patch.label !== undefined && !savedKeys.has(f.key)) {
					next.key = fieldKey(
						patch.label,
						fields.filter((_, k) => k !== i).map((o) => o.key),
					);
				}
				return next;
			}),
		);
	};
	const full = fields.length >= MAX_LEAD_FIELDS;

	return (
		<div className="space-y-3">
			{fields.length === 0 && (
				<p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
					No lead fields yet. Add your own or start from a template.
				</p>
			)}
			{fields.map((f, i) => (
				<FieldRow
					// biome-ignore lint/suspicious/noArrayIndexKey: a new field's key follows its label as it's typed; keying by it would remount the row on every keystroke
					key={i}
					field={f}
					errors={errors?.[i]}
					onChange={(patch) => update(i, patch)}
					onRemove={() => onChange(fields.filter((_, j) => j !== i))}
				/>
			))}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={full}
					onClick={() =>
						onChange([
							...fields,
							{ key: "", label: "", type: "text", mode: "ask" },
						])
					}
				>
					<PlusIcon />
					Add field
				</Button>
				<Select
					value=""
					disabled={full}
					onValueChange={(id) => {
						const t = LEAD_FIELD_TEMPLATES.find((x) => x.id === id);
						if (t) onChange(addTemplate(fields, t.fields, MAX_LEAD_FIELDS));
					}}
				>
					<SelectTrigger size="sm" className="w-auto">
						<SelectValue placeholder="Add from a template…" />
					</SelectTrigger>
					<SelectContent>
						{LEAD_FIELD_TEMPLATES.map((t) => (
							<SelectItem key={t.id} value={t.id}>
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="ml-auto text-xs text-muted-foreground">
					{fields.length}/{MAX_LEAD_FIELDS}
				</span>
			</div>
		</div>
	);
}

function FieldRow({
	field,
	errors,
	onChange,
	onRemove,
}: {
	field: LeadField;
	errors?: LeadFieldErrors[number];
	onChange: (patch: Partial<LeadField>) => void;
	onRemove: () => void;
}) {
	const id = useId();
	const message =
		errors?.label?.message ??
		errors?.key?.message ??
		errors?.options?.message ??
		errors?.hint?.message;

	return (
		<div className="space-y-2 rounded-lg border bg-card p-3">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					id={`${id}-label`}
					aria-label="Field name"
					value={field.label}
					maxLength={60}
					placeholder="e.g. Budget"
					onChange={(e) => onChange({ label: e.target.value })}
					className="h-8 min-w-40 flex-1"
				/>
				<Select
					value={field.type}
					onValueChange={(type) =>
						onChange({ type: type as LeadField["type"] })
					}
				>
					<SelectTrigger size="sm" className="w-28" aria-label="Field type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(LEAD_FIELD_TYPE_LABEL).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={field.mode}
					onValueChange={(mode) =>
						onChange({ mode: mode as LeadField["mode"] })
					}
				>
					<SelectTrigger
						size="sm"
						className="w-36"
						aria-label="When to capture"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ask">Ask for it</SelectItem>
						<SelectItem value="listen">Only if mentioned</SelectItem>
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label="Remove field"
					onClick={onRemove}
				>
					<XIcon />
				</Button>
			</div>
			<Input
				aria-label="Hint for the AI"
				value={field.hint ?? ""}
				maxLength={200}
				placeholder="Hint for the AI (optional), e.g. monthly budget in USD"
				onChange={(e) => onChange({ hint: e.target.value })}
				className="h-8 text-[13px]"
			/>
			{field.type === "choice" && (
				<OptionsInput
					value={field.options ?? []}
					onChange={(options) => onChange({ options })}
				/>
			)}
			{message && <p className="text-xs text-destructive">{message}</p>}
		</div>
	);
}

const parseOptions = (s: string) =>
	s
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean);

// Comma-separated options. The text is kept locally so typing a comma or a
// space isn't eaten; the form only ever sees the cleaned list.
function OptionsInput({
	value,
	onChange,
}: {
	value: string[];
	onChange: (options: string[]) => void;
}) {
	const [text, setText] = useState(value.join(", "));

	// Follow outside changes (form reset) without fighting the user's typing.
	useEffect(() => {
		setText((current) =>
			parseOptions(current).join("\u0000") === value.join("\u0000")
				? current
				: value.join(", "),
		);
	}, [value]);

	return (
		<Input
			aria-label="Choices"
			value={text}
			placeholder="Choices, separated by commas: Starter, Pro, Enterprise"
			onChange={(e) => {
				setText(e.target.value);
				onChange(parseOptions(e.target.value));
			}}
			className="h-8 text-[13px]"
		/>
	);
}
