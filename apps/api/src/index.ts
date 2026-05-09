import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { rollupYesterdayAllAgents } from "./crons/analytics-rollup";
import { reapIdleConversations } from "./crons/idle-reaper";
import { getAuth } from "./lib/auth";
import { apiApp } from "./routes";
import type { AppEnv, Bindings } from "./types";

// Cloudflare Workflows must be exported from the worker entrypoint so wrangler
// can wire the `class_name` declared in wrangler.jsonc. They run as a separate
// invocation from the fetch handler — env.KB_REEMBED.create({ params }) hands
// off to a fresh, durable execution context.
export { KbReembedWorkflow } from "./workflows/kb-reembed";
export { ConversationSummarizeWorkflow } from "./workflows/conversation-summarize";

// Durable Object class export — same wrangler-registers-by-name story.
// One instance per conversationId, addressed via env.CONVERSATION.idFromName.
export { ConversationDO } from "./durable/conversation";

const app = new OpenAPIHono<AppEnv>();

// Public widget endpoints are called from customer websites. They use widget
// tokens, not cookies, so they can accept any browser origin without
// credentialed CORS.
app.use(
	"/api/widget/*",
	cors({
		origin: "*",
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		maxAge: 600,
	}),
);

// Dashboard/API CORS configuration.
app.use("*", async (c, next) => {
	if (c.req.path.startsWith("/api/widget/")) {
		return next();
	}
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

// The Worker exports both `fetch` (Hono's app) AND `scheduled` (cron
// triggers). Wrangler routes by event type — fetch handles HTTP + WS,
// scheduled fires per the crons[] in wrangler.jsonc. Workers will reuse
// the same export shape both in dev and prod.
export default {
	fetch: app.fetch.bind(app),

	async scheduled(
		event: ScheduledEvent,
		env: Bindings,
		ctx: ExecutionContext,
	): Promise<void> {
		// Dispatch by cron string. wrangler.jsonc declares two:
		//   "*/5 * * * *"  → idle reaper
		//   "5 0 * * *"    → analytics rollup at 00:05 UTC
		// Anything else falls through to a logged warning.
		switch (event.cron) {
			case "*/5 * * * *": {
				ctx.waitUntil(
					reapIdleConversations(env)
						.then((r) =>
							console.log(`[cron:idle-reaper] reaped=${r.reaped}`),
						)
						.catch((err) =>
							console.error("[cron:idle-reaper] failed", err),
						),
				);
				return;
			}
			case "5 0 * * *": {
				ctx.waitUntil(
					rollupYesterdayAllAgents(env)
						.then((rs) =>
							console.log(`[cron:rollup] agents=${rs.length}`),
						)
						.catch((err) => console.error("[cron:rollup] failed", err)),
				);
				return;
			}
			default:
				console.warn(`[cron] unknown schedule: ${event.cron}`);
		}
	},
};
