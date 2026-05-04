// Typed API client for the dashboard. Wraps @leadly/api-client's
// createLeadlyClient with the right base URL (env-configurable, defaults
// to local wrangler dev) and cookie-based credentials so Better Auth's
// session rides along automatically.
//
// Usage:
//   import { api } from "@/lib/api";
//   const orgs = await api.orgs.list();
//   const agent = await api.agents.create(orgId, { name: "Acme Support" });
//
// Errors throw `LeadlyApiError`; TanStack Query handles them as normal
// rejected promises. No more axios `.data` unwrapping at every call site.

import { createLeadlyClient, LeadlyApiError } from "@leadly/api-client";

// Strip a trailing /api so the typed client can prepend its own /api/...
// paths. Both wrangler dev (no trailing /api) and the Cloudflare prod
// host (auth client uses VITE_API_URL with /api appended) work.
const RAW = import.meta.env.VITE_API_URL || "http://localhost:8787/api";
const API_BASE_URL = RAW.replace(/\/api\/?$/, "");

export const api = createLeadlyClient({ baseUrl: API_BASE_URL });

export { LeadlyApiError };
