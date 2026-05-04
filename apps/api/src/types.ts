// Shared Hono environment for the api. Bindings are the wrangler.jsonc-declared
// secrets, env vars, and resource bindings. Variables are values that
// middleware attaches to the request context for downstream handlers to read.

import type { AuthUser } from "./middleware/auth";
import type {
	ResolvedAgent,
	ResolvedMembership,
} from "./middleware/org";

export type Bindings = {
	DATABASE_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	CORS_ORIGIN?: string;
	OPENROUTER_API_KEY: string;
	MEDIA_BUCKET: R2Bucket;
	KB_REEMBED: Workflow;
};

export type Variables = {
	// authMiddleware
	user: AuthUser;
	session: unknown;
	// requireOrgMember / requireOrgAdmin / requireAgentAccess
	membership: ResolvedMembership;
	agent: ResolvedAgent;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };

// ---------- Workarounds for prisma/prisma#28703 ----------
// Prisma 7's @prisma/extension-accelerate drops relation types from query
// results when `include`/`select` is used with a `where` clause. The runtime
// is correct — only the inferred TS type is wrong. We declare the shapes we
// need here and cast at the call site. Remove these once the upstream fix
// lands and we bump the prisma-client version.

export type MembershipWithUser = {
	id: string;
	organizationId: string;
	userId: string;
	role: "owner" | "admin" | "member";
	createdAt: Date;
	user: { id: string; name: string; email: string; image: string | null };
};
