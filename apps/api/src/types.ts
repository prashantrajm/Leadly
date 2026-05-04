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
	MEDIA_BUCKET: R2Bucket;
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
