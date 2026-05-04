import { OpenAPIHono } from "@hono/zod-openapi";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types";
import { agentsApp, orgAgentsApp } from "./agents";
import { kbApp } from "./kb";
import { orgsApp } from "./orgs";

export const apiApp = new OpenAPIHono<AppEnv>();

// Health check endpoint (public)
apiApp.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Leadly API",
  });
});

// Authenticated route groups. authMiddleware runs at the mount so each child
// router stays auth-agnostic and tests can swap in a fake guard via .use().
const authed = new OpenAPIHono<AppEnv>();
authed.use("*", authMiddleware);
authed.route("/orgs", orgsApp);
authed.route("/orgs/:orgId/agents", orgAgentsApp);
authed.route("/agents", agentsApp);
authed.route("/agents/:agentId/kb", kbApp);
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
