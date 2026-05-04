import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { getAuth } from "./lib/auth";
import { apiApp } from "./routes";
import type { AppEnv } from "./types";

// Cloudflare Workflows must be exported from the worker entrypoint so wrangler
// can wire the `class_name` declared in wrangler.jsonc. They run as a separate
// invocation from the fetch handler — env.KB_REEMBED.create({ params }) hands
// off to a fresh, durable execution context.
export { KbReembedWorkflow } from "./workflows/kb-reembed";

// Durable Object class export — same wrangler-registers-by-name story.
// One instance per conversationId, addressed via env.CONVERSATION.idFromName.
export { ConversationDO } from "./durable/conversation";

const app = new OpenAPIHono<AppEnv>();

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

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
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
