import { zodResolver } from "@hookform/resolvers/zod";
import {
	CreateKbArticleSchema,
	UpdateKbArticleSchema,
	type CreateKbArticle,
	type UpdateKbArticle,
} from "@leadly/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Eye,
	Loader2,
	PencilLine,
	Save,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";

type Mode =
	| { kind: "create"; agentId: string }
	| {
			kind: "edit";
			agentId: string;
			articleId: string;
			initial: { title: string; contentMarkdown: string };
		};

export function ArticleEditor({ mode }: { mode: Mode }) {
	const orgPath = useOrgPath();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [view, setView] = useState<"edit" | "preview">("edit");

	// Two distinct form types because Create and Update have different
	// optional/required shapes — but the field names overlap so the markup
	// is shared.
	const form = useForm<CreateKbArticle | UpdateKbArticle>({
		resolver: zodResolver(
			mode.kind === "create" ? CreateKbArticleSchema : UpdateKbArticleSchema,
		),
		defaultValues:
			mode.kind === "create"
				? { title: "", contentMarkdown: "" }
				: {
						title: mode.initial.title,
						contentMarkdown: mode.initial.contentMarkdown,
					},
	});

	const createMutation = useMutation({
		mutationFn: (body: CreateKbArticle) =>
			api.kb.create(mode.kind === "create" ? mode.agentId : "", body),
		onSuccess: (article) => {
			queryClient.invalidateQueries({
				queryKey: ["kb", mode.kind === "create" ? mode.agentId : ""],
			});
			navigate({
				to: orgPath(`/agents/${mode.kind === "create" ? mode.agentId : ""}/knowledge/${article.id}`) as string,
			});
		},
	});

	const updateMutation = useMutation({
		mutationFn: (body: UpdateKbArticle) =>
			mode.kind === "edit"
				? api.kb.update(mode.agentId, mode.articleId, body)
				: Promise.reject(new Error("not in edit mode")),
		onSuccess: () => {
			if (mode.kind !== "edit") return;
			queryClient.invalidateQueries({ queryKey: ["kb", mode.agentId] });
			queryClient.invalidateQueries({
				queryKey: ["kb-article", mode.agentId, mode.articleId],
			});
			form.reset(form.getValues());
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () =>
			mode.kind === "edit"
				? api.kb.delete(mode.agentId, mode.articleId)
				: Promise.reject(new Error("not in edit mode")),
		onSuccess: () => {
			if (mode.kind !== "edit") return;
			queryClient.invalidateQueries({ queryKey: ["kb", mode.agentId] });
			navigate({
				to: orgPath(`/agents/${mode.agentId}/knowledge`) as string,
			});
		},
	});

	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

	function onSubmit(values: CreateKbArticle | UpdateKbArticle) {
		if (mode.kind === "create") {
			createMutation.mutate(values as CreateKbArticle);
		} else {
			updateMutation.mutate(values);
		}
	}

	const saving = createMutation.isPending || updateMutation.isPending;
	const error = createMutation.error ?? updateMutation.error;
	const dirty = form.formState.isDirty;
	const content = form.watch("contentMarkdown") ?? "";

	return (
		<div className="mx-auto max-w-5xl">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between gap-3">
				<Button asChild variant="ghost" size="sm" className="-ml-2">
					<Link
						to={orgPath(`/agents/${mode.agentId}/knowledge`) as string}
					>
						<ArrowLeft className="mr-1 size-4" />
						Knowledge base
					</Link>
				</Button>
				<div className="flex items-center gap-2">
					{mode.kind === "edit" && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setConfirmDeleteOpen(true)}
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2 className="mr-1 size-4" />
							Delete
						</Button>
					)}
					<Button
						onClick={form.handleSubmit(onSubmit)}
						disabled={saving || (mode.kind === "edit" && !dirty)}
						size="sm"
						className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
					>
						{saving ? (
							<Loader2 className="mr-1 size-4 animate-spin" />
						) : (
							<Save className="mr-1 size-4" />
						)}
						{mode.kind === "create" ? "Create article" : "Save changes"}
					</Button>
				</div>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Title</FormLabel>
								<FormControl>
									<Input
										placeholder="How do refunds work?"
										className="text-base font-semibold"
										{...field}
										value={field.value ?? ""}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="contentMarkdown"
						render={({ field }) => (
							<FormItem>
								<div className="mb-2 flex items-center justify-between">
									<FormLabel>Markdown</FormLabel>
									<Tabs
										value={view}
										onValueChange={(v) => setView(v as "edit" | "preview")}
									>
										<TabsList className="h-8">
											<TabsTrigger value="edit" className="gap-1 text-xs">
												<PencilLine className="size-3.5" />
												Write
											</TabsTrigger>
											<TabsTrigger value="preview" className="gap-1 text-xs">
												<Eye className="size-3.5" />
												Preview
											</TabsTrigger>
										</TabsList>
									</Tabs>
								</div>
								<Tabs value={view}>
									<TabsContent value="edit" className="mt-0">
										<FormControl>
											<Textarea
												rows={22}
												placeholder={
													"## How do refunds work?\n\nWe refund within 14 days of purchase, no questions asked. Email refunds@yourco.com with your order number.\n\n## What about international orders?\n\nSame policy. Shipping costs aren't refunded."
												}
												className="font-mono text-sm leading-relaxed"
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
									</TabsContent>
									<TabsContent value="preview" className="mt-0">
										<div className="min-h-[460px] rounded-md border border-border bg-card p-6">
											{content.trim() === "" ? (
												<p className="text-sm italic text-muted-foreground">
													Nothing to preview yet.
												</p>
											) : (
												<MarkdownPreview source={content} />
											)}
										</div>
									</TabsContent>
								</Tabs>
								<FormMessage />
								<p className="mt-1 text-xs text-muted-foreground">
									Headings (## …) drive retrieval — write them like questions
									a visitor would ask.
								</p>
							</FormItem>
						)}
					/>

					{error && (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
							{error instanceof LeadlyApiError
								? `API ${error.status}: ${error.bodyText.slice(0, 200) || error.message}`
								: error instanceof Error
									? error.message
									: "Save failed."}
						</div>
					)}
				</form>
			</Form>

			<AlertDialog
				open={confirmDeleteOpen}
				onOpenChange={setConfirmDeleteOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this article?</AlertDialogTitle>
						<AlertDialogDescription>
							The article and all its embedded chunks will be removed. The
							agent will stop citing it on the next conversation.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								deleteMutation.mutate();
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{deleteMutation.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function MarkdownPreview({ source }: { source: string }) {
	// Hand-rolled prose styles — keeps the bundle small and matches the
	// rest of the dashboard's tracking/spacing conventions. If we ever need
	// real typography ergonomics (footnotes, definition lists, etc.), the
	// official tailwindcss-typography plugin slots in here.
	return (
		<div
			className="
				max-w-none text-sm leading-relaxed text-foreground
				[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight
				[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight
				[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
				[&_p]:my-3
				[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5
				[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5
				[&_li]:my-1
				[&_a]:text-accent-blue [&_a]:underline-offset-4 hover:[&_a]:underline
				[&_code]:rounded [&_code]:bg-secondary/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
				[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-secondary/40 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs
				[&_pre_code]:bg-transparent [&_pre_code]:p-0
				[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-blue/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground
				[&_hr]:my-6 [&_hr]:border-border/60
				[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
				[&_th]:border [&_th]:border-border [&_th]:bg-secondary/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
				[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
			"
		>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
		</div>
	);
}
