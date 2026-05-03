import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
};

export const authMiddleware = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user as AuthUser);
  c.set("session", session.session);
  return next();
};

export const requireRole = (...roles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as AuthUser | undefined;

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!roles.includes(user.role)) {
      return c.json(
        { error: "Forbidden", message: `Required role: ${roles.join(" or ")}` },
        403,
      );
    }

    return next();
  };
};

export const requireBusinessOwner = requireRole("business_owner", "admin");
export const requireAdmin = requireRole("admin");
