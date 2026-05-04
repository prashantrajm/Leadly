import { OpenAPIHono } from "@hono/zod-openapi";
import { HealthSchema } from "@leadly/schemas";
import { cors } from "hono/cors";
import { getAuth } from "./lib/auth";
import { apiApp } from "./routes";

type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  CORS_ORIGIN?: string;
  MEDIA_BUCKET: R2Bucket;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// CORS configuration
app.use("*", async (c, next) => {
  const origin = c.env.CORS_ORIGIN;
  if (!origin) {
    return next();
  }
  return cors({
    origin: origin,
    allowHeaders: ["Content-Type", "Authorization", "x-better-auth-session-id"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// Authentication routes (Better Auth)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Mount API routes
app.route("/api", apiApp);

// Health check — validated against the shared @leadly/schemas Health shape
// so any contract drift breaks at typecheck time, not at runtime.
app.get("/health", (c) => {
  const payload = HealthSchema.parse({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
  return c.json(payload);
});

// OpenAPI documentation endpoint
app.doc("/doc", (c) => ({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Leadly API',
  },
  servers: [
    {
      url: new URL(c.req.url).origin,
      description: 'Current environment',
    },
  ],
}))

export default app;
