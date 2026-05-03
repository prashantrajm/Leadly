import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { apiApp } from "./routes";

const app = new OpenAPIHono();

app.use("*", async (c, next) => {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) {
    return next();
  }
  return cors({
    origin,
    allowHeaders: ["Content-Type", "Authorization", "x-better-auth-session-id"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// Better Auth
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api", apiApp);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
  }),
);

app.doc("/doc", (c) => ({
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Leadly API",
  },
  servers: [
    {
      url: new URL(c.req.url).origin,
      description: "Current environment",
    },
  ],
}));

const port = Number(process.env.PORT) || 8787;

export default {
  port,
  fetch: app.fetch,
};
