import { OpenAPIHono } from "@hono/zod-openapi";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types";
import { agentsApp, orgAgentsApp } from "./agents";
import {
	agentConversationsApp,
	conversationsApp,
	conversationsInboxApp,
} from "./conversations";
import { kbApp } from "./kb";
import { agentLeadsApp, leadsApp } from "./leads";
import { orgsApp } from "./orgs";
import { agentVisitorsApp, visitorsApp } from "./visitors";
import { widgetApp } from "./widget";

export const apiApp = new OpenAPIHono<AppEnv>();

// Health check endpoint (public)
apiApp.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Leadly API",
  });
});

// Public surfaces (no Better Auth session). The widget endpoints are
// what the iframe on a customer's site calls; the conversation WS upgrade
// is what the widget connects to after it has a conversationId.
apiApp.route("/widget", widgetApp);
apiApp.route("/conversations", conversationsApp);

// Authenticated route groups. authMiddleware runs at the mount so each child
// router stays auth-agnostic and tests can swap in a fake guard via .use().
const authed = new OpenAPIHono<AppEnv>();
authed.use("*", authMiddleware);
authed.route("/orgs", orgsApp);
authed.route("/orgs/:orgId/agents", orgAgentsApp);
authed.route("/agents", agentsApp);
authed.route("/agents/:agentId/kb", kbApp);
authed.route("/agents/:agentId/visitors", agentVisitorsApp);
authed.route("/agents/:agentId/leads", agentLeadsApp);
authed.route("/agents/:agentId/conversations", agentConversationsApp);
authed.route("/visitors", visitorsApp);
authed.route("/leads", leadsApp);
authed.route("/conversations", conversationsInboxApp);
apiApp.route("/", authed);

// OpenAPI documentation endpoint
apiApp.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Leadly API",
    description: "API for Leadly — AI support platform with knowledge base and lead capture.",
  },
});
