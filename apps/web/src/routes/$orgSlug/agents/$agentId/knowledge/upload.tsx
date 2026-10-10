import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	FileTextIcon,
	SpinnerIcon,
	UploadIcon,
	XIcon,
} from "@/components/icons";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Page, PageContent, PageToolbar } from "@/components/ui/page";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";

const ACCEPTED_TYPES = [".md", ".markdown", ".txt"];
const MAX_BYTES = 50_000;

export const Route = createFileRoute(
	"/$orgSlug/agents/$agentId/knowledge/upload",
)({
	component: UploadPage,
});

function UploadPage() {
	const orgPath = useOrgPath();
	const { agentId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);

	const [file, setFile] = useState<File | null>(null);
	const [title, setTitle] = useState("");
	const [titleEdited, setTitleEdited] = useState(false);
	const [dragOver, setDragOver] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: () =>
			file
				? api.kb.upload(agentId, file, title)
				: Promise.reject(new Error("No file picked")),
		onSuccess: (article) => {
			queryClient.invalidateQueries({ queryKey: ["kb", agentId] });
			navigate({
				to:
					orgPath(`/agents/${agentId}/knowledge/${article.id}`) as string,
			});
		},
	});

	function pickFile(f: File | null) {
		setLocalError(null);
		if (!f) {
			setFile(null);
			return;
		}
		const lower = f.name.toLowerCase();
		const okExt = ACCEPTED_TYPES.some((ext) => lower.endsWith(ext));
		if (!okExt) {
			setLocalError("Only .md, .markdown, and .txt files are accepted.");
			return;
		}
		if (f.size > MAX_BYTES) {
			setLocalError(
				`File is ${(f.size / 1024).toFixed(1)} KB — limit is ${MAX_BYTES / 1000} KB. Split it into smaller articles.`,
			);
			return;
		}
		setFile(f);
		// Default the title to the filename without extension, but stop
		// auto-filling once the user has typed.
		if (!titleEdited) {
			const stem = f.name.replace(/\.(md|markdown|txt)$/i, "");
			setTitle(stem);
		}
	}

	const canSubmit = Boolean(file) && title.trim().length >= 2 && !mutation.isPending;

	return (
		<Page>
			<PageToolbar>
				<Button asChild variant="ghost" size="sm" className="-ml-2">
					<Link
						to={orgPath(`/agents/${agentId}/knowledge`) as string}
					>
						<ArrowLeftIcon />
						Knowledge base
					</Link>
				</Button>
			</PageToolbar>

			<PageContent width="narrow">
				<div className="space-y-6">
					{/* Dropzone */}
					{file ? (
						<div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card shadow-raised">
								<FileTextIcon className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium">{file.name}</div>
								<div className="font-mono text-[11px] text-muted-foreground">
									{(file.size / 1024).toFixed(1)} KB
								</div>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => {
									setFile(null);
									if (inputRef.current) inputRef.current.value = "";
								}}
								className="text-muted-foreground hover:text-foreground"
							>
								<XIcon className="size-4" />
								<span className="sr-only">Remove file</span>
							</Button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => inputRef.current?.click()}
							onDragOver={(e) => {
								e.preventDefault();
								setDragOver(true);
							}}
							onDragLeave={() => setDragOver(false)}
							onDrop={(e) => {
								e.preventDefault();
								setDragOver(false);
								const f = e.dataTransfer.files[0];
								if (f) pickFile(f);
							}}
							className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
								dragOver
									? "border-accent-blue/60 bg-accent-blue/5"
									: "border-border hover:bg-muted/60"
							}`}
						>
							<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<UploadIcon className="size-5" />
							</div>
							<div>
								<div className="text-sm font-medium">
									Drop a file here, or click to browse
								</div>
								<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
									.md · .markdown · .txt · 50 KB max
								</div>
							</div>
						</button>
					)}

					<input
						ref={inputRef}
						type="file"
						accept={ACCEPTED_TYPES.join(",")}
						className="hidden"
						onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
					/>

					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="article-title">Title</Label>
						<Input
							id="article-title"
							value={title}
							onChange={(e) => {
								setTitle(e.target.value);
								setTitleEdited(true);
							}}
							placeholder="How do refunds work?"
						/>
						<p className="text-xs text-muted-foreground">
							This is what shows up in the article list and (if your file
							doesn't already have a heading) drives the first retrieval
							match.
						</p>
					</div>

					{/* Errors */}
					{localError && (
						<p className="text-sm text-destructive">{localError}</p>
					)}
					{mutation.isError && (
						<p className="text-sm text-destructive">
							{mutation.error instanceof LeadlyApiError
								? `API ${mutation.error.status}: ${mutation.error.bodyText.slice(0, 200) || mutation.error.message}`
								: mutation.error instanceof Error
									? mutation.error.message
									: "Upload failed."}
						</p>
					)}

					{/* Actions */}
					<div className="flex justify-end gap-2">
						<Button asChild variant="outline" size="sm" type="button">
							<Link
								to={orgPath(`/agents/${agentId}/knowledge`) as string}
							>
								Cancel
							</Link>
						</Button>
						<Button
							variant="accent"
							onClick={() => mutation.mutate()}
							size="sm"
							disabled={!canSubmit}
						>
							{mutation.isPending ? (
								<SpinnerIcon className="animate-spin" />
							) : (
								<UploadIcon />
							)}
							Upload
						</Button>
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
