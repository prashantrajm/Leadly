// Workspace URL availability for the create / rename forms. Separate router
// so /orgs/{orgId} can't swallow the path.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { ErrorSchema, OrgSlugAvailabilitySchema } from "@leadly/schemas";
import { checkSlugAvailability } from "../lib/org-slug";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";

export const orgSlugsApp = new OpenAPIHono<AppEnv>();

const availabilityRoute = createRoute({
	method: "get",
	path: "/availability",
	tags: ["Organizations"],
	request: { query: z.object({ slug: z.string().max(100) }) },
	responses: {
		200: {
			content: { "application/json": { schema: OrgSlugAvailabilitySchema } },
			description: "Whether the slug is free, and a free alternative if not",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

orgSlugsApp.openapi(availabilityRoute, async (c) => {
	const { slug } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);
	return c.json(await checkSlugAvailability(prisma, slug), 200);
});
