import type { Context, Next } from "hono";
import { getAuth } from "../lib/auth";

type Bindings = {
	DATABASE_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	CORS_ORIGIN?: string;
};

export type AuthUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
};

// biome-ignore lint/suspicious/noExplicitAny: hono context is generic across routes
export const authMiddleware = async (c: Context<any>, next: Next) => {
	const auth = getAuth(c.env as Bindings);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("user", session.user as AuthUser);
	c.set("session", session.session);
	return next();
};
