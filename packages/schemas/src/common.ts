import { z } from "@hono/zod-openapi";

// Wire convention: dates travel as ISO 8601 strings. Server stringifies on the
// way out; clients parse to Date as needed. Keeps OpenAPI clean and avoids the
// z.union([string, date]) ambiguity that plagued the earlier template schemas.
export const IsoDate = z.iso.datetime().openapi({
	format: "date-time",
	example: "2026-05-04T15:00:00.000Z",
});

// CUID2-style ids are what Prisma's @default(cuid()) emits. Treated as opaque
// strings everywhere — no parsing, no length assumptions in business logic.
export const Cuid = z.string().min(1).openapi({ example: "clx12abcd0000xyz" });

export const ErrorSchema = z
	.object({
		error: z.string(),
		message: z.string().optional(),
	})
	.openapi("Error");

export const SuccessSchema = z
	.object({
		success: z.literal(true),
		message: z.string().optional(),
	})
	.openapi("Success");

// Cursor pagination: clients pass `cursor` (opaque base64 of {createdAt, id})
// and `limit`. Server returns `items[]` and a `nextCursor` (null at end).
export const PaginationQuery = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginatedResponse<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		items: z.array(item),
		nextCursor: z.string().nullable(),
	});
}
