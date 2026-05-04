import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types";
import { uploadsApp } from "./uploads";

export const apiApp = new OpenAPIHono<AppEnv>();

// Health check endpoint
apiApp.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Leadly API",
  });
});

// Mount all routes
apiApp.route("/uploads", uploadsApp);

// OpenAPI documentation endpoint
apiApp.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Leadly API",
    description: "API for Leadly — AI support platform with knowledge base and lead capture.",
  },
});
