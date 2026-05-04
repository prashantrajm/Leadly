import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { KbArticleSource } from "./enums.ts";

// ---------- KbArticle ----------

export const KbArticleSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		title: z.string(),
		contentMarkdown: z.string(),
		source: KbArticleSource,
		uploadKey: z.string().nullable(),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("KbArticle");
export type KbArticle = z.infer<typeof KbArticleSchema>;

// ~50KB upper bound on a single article — well above any sensible policy doc,
// well below anything that would explode chunking or embedding cost. If a
// customer hits this, they should split the article.
const MAX_ARTICLE_BYTES = 50_000;

export const CreateKbArticleSchema = z
	.object({
		title: z.string().min(2).max(200),
		contentMarkdown: z.string().min(1).max(MAX_ARTICLE_BYTES),
		source: KbArticleSource.default("manual"),
		uploadKey: z.string().optional(),
	})
	.openapi("CreateKbArticle");
export type CreateKbArticle = z.infer<typeof CreateKbArticleSchema>;

export const UpdateKbArticleSchema = z
	.object({
		title: z.string().min(2).max(200).optional(),
		contentMarkdown: z.string().min(1).max(MAX_ARTICLE_BYTES).optional(),
	})
	.openapi("UpdateKbArticle");
export type UpdateKbArticle = z.infer<typeof UpdateKbArticleSchema>;

// Compact view for list endpoints — no full markdown body.
export const KbArticleListItemSchema = KbArticleSchema.omit({
	contentMarkdown: true,
})
	.extend({
		chunkCount: z.number().int().nonnegative(),
	})
	.openapi("KbArticleListItem");
export type KbArticleListItem = z.infer<typeof KbArticleListItemSchema>;

// ---------- Upload flow ----------

export const RequestUploadUrlSchema = z
	.object({
		filename: z.string().min(1).max(200),
		contentType: z.enum(["text/markdown", "text/plain"]),
		sizeBytes: z.number().int().positive().max(MAX_ARTICLE_BYTES),
	})
	.openapi("RequestUploadUrl");
export type RequestUploadUrl = z.infer<typeof RequestUploadUrlSchema>;

export const UploadUrlResponseSchema = z
	.object({
		uploadUrl: z.string().url(),
		// Key the client passes back to /from-upload to register the article.
		key: z.string(),
	})
	.openapi("UploadUrlResponse");
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const RegisterFromUploadSchema = z
	.object({
		key: z.string().min(1),
		title: z.string().min(2).max(200),
	})
	.openapi("RegisterFromUpload");
export type RegisterFromUpload = z.infer<typeof RegisterFromUploadSchema>;

// ---------- KbChunk ----------
// Chunks are not addressable through the public API — they're internal to
// retrieval. The schema exists so DO/agent-loop code shares one shape.

export const KbChunkSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		articleId: Cuid,
		ord: z.number().int().nonnegative(),
		text: z.string(),
		tokens: z.number().int().nonnegative(),
		createdAt: IsoDate,
		// embedding intentionally omitted — never sent over the wire.
	})
	.openapi("KbChunk");
export type KbChunk = z.infer<typeof KbChunkSchema>;

export const RetrievedChunkSchema = z
	.object({
		chunkId: Cuid,
		articleId: Cuid,
		articleTitle: z.string(),
		text: z.string(),
		distance: z.number(), // cosine distance 0..2
	})
	.openapi("RetrievedChunk");
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
