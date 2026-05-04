import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	CreateKbArticleSchema,
	ErrorSchema,
	KbArticleListItemSchema,
	KbArticleSchema,
	SuccessSchema,
	UpdateKbArticleSchema,
} from "@leadly/schemas";
import { requireAgentAccess } from "../middleware/org";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";

// Upload limits — kept in sync with packages/schemas/src/kb.ts.
// 50KB ceiling lets us run uploads through the Worker rather than the
// pre-signed URL dance (see design §5.5 for what we're deferring and why
// the simpler path is fine for v1).
const MAX_UPLOAD_BYTES = 50_000;
const ALLOWED_UPLOAD_MIME = new Set(["text/markdown", "text/plain"]);

// Mounted under /api/agents/:agentId/kb in routes/index.ts. Every operation
// sits behind requireAgentAccess so the caller is always confirmed to belong
// to the org that owns the article.

export const kbApp = new OpenAPIHono<AppEnv>();

// ---------- list ----------

const listArticlesRoute = createRoute({
	method: "get",
	path: "/articles",
	tags: ["KB"],
	request: { params: z.object({ agentId: z.string() }) },
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: {
				"application/json": { schema: z.array(KbArticleListItemSchema) },
			},
			description: "Articles for the agent (no full markdown)",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

kbApp.openapi(listArticlesRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// We omit `contentMarkdown` from the list view because the dashboard's
	// list page only needs metadata. Loading every article body for an org
	// with hundreds of KB pages would blow the response size for no reason.
	const articles = await prisma.kbArticle.findMany({
		where: { agentId },
		orderBy: { updatedAt: "desc" },
		select: {
			id: true,
			organizationId: true,
			agentId: true,
			title: true,
			source: true,
			uploadKey: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	// groupBy types are flattened by extension-accelerate (prisma/prisma#28703-adjacent),
	// so cast through unknown to the known shape.
	type ChunkGroup = { articleId: string; _count: { _all: number } };
	const counts = (await prisma.kbChunk.groupBy({
		by: ["articleId"],
		where: { agentId },
		_count: { _all: true },
	})) as unknown as ChunkGroup[];
	const countByArticle = new Map(
		counts.map((c) => [c.articleId, c._count._all]),
	);

	return c.json(
		articles.map((a) => ({
			id: a.id,
			organizationId: a.organizationId,
			agentId: a.agentId,
			title: a.title,
			source: a.source,
			uploadKey: a.uploadKey,
			createdAt: a.createdAt.toISOString(),
			updatedAt: a.updatedAt.toISOString(),
			chunkCount: countByArticle.get(a.id) ?? 0,
		})),
		200,
	);
});

// ---------- get ----------

const getArticleRoute = createRoute({
	method: "get",
	path: "/articles/{articleId}",
	tags: ["KB"],
	request: {
		params: z.object({ agentId: z.string(), articleId: z.string() }),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: KbArticleSchema } },
			description: "Article including markdown",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

kbApp.openapi(getArticleRoute, async (c) => {
	const { agentId, articleId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const article = await prisma.kbArticle.findUnique({
		where: { id: articleId },
	});
	// Cross-agent reads must 404 (not 403) so we don't leak whether the
	// article exists at all in another org's KB.
	if (!article || article.agentId !== agentId) {
		return c.json({ error: "Article not found" }, 404);
	}
	return c.json(toWire(article), 200);
});

// ---------- create ----------

const createArticleRoute = createRoute({
	method: "post",
	path: "/articles",
	tags: ["KB"],
	request: {
		params: z.object({ agentId: z.string() }),
		body: { content: { "application/json": { schema: CreateKbArticleSchema } } },
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		201: {
			content: { "application/json": { schema: KbArticleSchema } },
			description: "Created",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

kbApp.openapi(createArticleRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const input = c.req.valid("json");
	const agent = c.get("agent");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const article = await prisma.kbArticle.create({
		data: {
			organizationId: agent.organizationId,
			agentId,
			title: input.title,
			contentMarkdown: input.contentMarkdown,
			source: input.source,
			uploadKey: input.uploadKey ?? null,
		},
	});

	await triggerReembed(c.env, article.id);

	return c.json(toWire(article), 201);
});

// ---------- patch ----------

const patchArticleRoute = createRoute({
	method: "patch",
	path: "/articles/{articleId}",
	tags: ["KB"],
	request: {
		params: z.object({ agentId: z.string(), articleId: z.string() }),
		body: { content: { "application/json": { schema: UpdateKbArticleSchema } } },
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: KbArticleSchema } },
			description: "Updated",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

kbApp.openapi(patchArticleRoute, async (c) => {
	const { agentId, articleId } = c.req.valid("param");
	const patch = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const existing = await prisma.kbArticle.findUnique({
		where: { id: articleId },
	});
	if (!existing || existing.agentId !== agentId) {
		return c.json({ error: "Article not found" }, 404);
	}

	const updated = await prisma.kbArticle.update({
		where: { id: articleId },
		data: patch,
	});

	// Re-embed only when the body changed; title-only edits don't affect
	// retrieval and re-embedding 25 chunks for a typo would be wasteful.
	if (patch.contentMarkdown !== undefined) {
		await triggerReembed(c.env, updated.id);
	}

	return c.json(toWire(updated), 200);
});

// ---------- delete ----------

const deleteArticleRoute = createRoute({
	method: "delete",
	path: "/articles/{articleId}",
	tags: ["KB"],
	request: {
		params: z.object({ agentId: z.string(), articleId: z.string() }),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: SuccessSchema } },
			description: "Deleted",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

kbApp.openapi(deleteArticleRoute, async (c) => {
	const { agentId, articleId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const existing = await prisma.kbArticle.findUnique({
		where: { id: articleId },
	});
	if (!existing || existing.agentId !== agentId) {
		return c.json({ error: "Article not found" }, 404);
	}

	// Chunks cascade via onDelete: Cascade in the schema, so a single delete
	// here clears retrieval for this article too. No orphaned vectors.
	await prisma.kbArticle.delete({ where: { id: articleId } });

	return c.json({ success: true as const }, 200);
});

// ---------- upload (.md / .txt → R2 + create article) ----------

const uploadArticleRoute = createRoute({
	method: "post",
	path: "/articles/upload",
	tags: ["KB"],
	request: {
		params: z.object({ agentId: z.string() }),
		body: {
			content: {
				"multipart/form-data": {
					schema: z.object({
						file: z.any().openapi({ type: "string", format: "binary" }),
						title: z.string().min(2).max(200),
					}),
				},
			},
		},
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		201: {
			content: { "application/json": { schema: KbArticleSchema } },
			description: "Article created from upload",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid file (size, type, or missing fields)",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

kbApp.openapi(uploadArticleRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const agent = c.get("agent");

	const form = await c.req.parseBody();
	const file = form["file"];
	const title = typeof form["title"] === "string" ? form["title"] : "";

	if (!(file instanceof File)) {
		return c.json({ error: "No file uploaded" }, 400);
	}
	if (title.length < 2 || title.length > 200) {
		return c.json({ error: "Title must be 2-200 chars" }, 400);
	}
	// File.type can include parameters (e.g. "text/plain;charset=utf-8") when
	// the browser/Blob serializer attaches an encoding. Strip parameters so
	// the comparison stays robust to that.
	const mime = (file.type || "").split(";")[0].trim().toLowerCase();
	if (!ALLOWED_UPLOAD_MIME.has(mime)) {
		return c.json(
			{
				error: "Unsupported file type",
				message: `Got ${file.type || "unknown"}; allowed: text/markdown, text/plain`,
			},
			400,
		);
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		return c.json(
			{
				error: "File too large",
				message: `Max ${MAX_UPLOAD_BYTES} bytes; got ${file.size}`,
			},
			400,
		);
	}

	const text = await file.text();
	if (text.trim().length === 0) {
		return c.json({ error: "File is empty" }, 400);
	}

	// Deterministic key: org-scoped path + cuid filename. The .md/.txt suffix
	// preserves intent for anyone poking at the bucket directly.
	const cuid = newCuid();
	const ext = mime === "text/markdown" ? "md" : "txt";
	const uploadKey = `org/${agent.organizationId}/agent/${agentId}/kb/${cuid}.${ext}`;

	await c.env.MEDIA_BUCKET.put(uploadKey, text, {
		httpMetadata: { contentType: mime },
	});

	const prisma = getPrisma(c.env.DATABASE_URL);
	const article = await prisma.kbArticle.create({
		data: {
			organizationId: agent.organizationId,
			agentId,
			title,
			contentMarkdown: text,
			source: "upload",
			uploadKey,
		},
	});

	await triggerReembed(c.env, article.id);

	return c.json(toWire(article), 201);
});

// ---------- helpers ----------

// Fire-and-forget kick to the KB re-embed workflow. The workflow runs in a
// separate execution context, so the route returns immediately while
// chunking + embedding happen in the background. Tests run with KB_REEMBED
// unset and silently skip — they don't exercise the workflow surface, only
// the article persistence shape.
async function triggerReembed(
	env: { KB_REEMBED?: Workflow },
	articleId: string,
): Promise<void> {
	if (!env.KB_REEMBED) return;
	try {
		await env.KB_REEMBED.create({ params: { articleId } });
	} catch (err) {
		// Don't fail the user-facing CRUD call because background re-embed
		// scheduling failed; the cron reaper (Phase 12) will pick up
		// articles whose chunks haven't been refreshed.
		console.error("[kb] failed to schedule re-embed", articleId, err);
	}
}

// Lightweight cuid-ish generator. Workers don't ship Node's crypto by default,
// so we lean on Web Crypto's getRandomValues. Output is 22 chars of base36
// — collision-resistant for our scale (per-org bucket of articles).
function newCuid() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) out += b.toString(36).padStart(2, "0");
	return out.slice(0, 22);
}

function toWire(a: {
	id: string;
	organizationId: string;
	agentId: string;
	title: string;
	contentMarkdown: string;
	source: "manual" | "upload";
	uploadKey: string | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: a.id,
		organizationId: a.organizationId,
		agentId: a.agentId,
		title: a.title,
		contentMarkdown: a.contentMarkdown,
		source: a.source,
		uploadKey: a.uploadKey,
		createdAt: a.createdAt.toISOString(),
		updatedAt: a.updatedAt.toISOString(),
	};
}
