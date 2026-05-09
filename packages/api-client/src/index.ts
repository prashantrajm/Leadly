// Typed client for the dashboard. The shape is deliberately one tier
// thinner than Hono RPC's full inferred client:
//
//   • runtime — fetch with shared base URL, credentials, and JSON
//                handling. Errors throw, so TanStack Query mutations
//                propagate cleanly without a status-check ladder.
//   • types   — every request body and response goes through the
//                schemas exported from @leadly/schemas. So the type of
//                `client.agents.create({ name: "..." })` is
//                `Promise<Agent>` and the body is enforced as
//                `CreateAgent`.
//
// We don't lean on Hono's `hc<typeof apiApp>` here because chaining
// every `.route()` to surface them in the inferred type would be a
// structural rewrite of routes/index.ts. The schema-typed wrapper gets
// us the same end-user DX (autocomplete on body fields, return type
// known, errors at compile time) without the structural change.

import type {
	Agent,
	AnalyticsSummary,
	AnalyticsTimeseries,
	CaptureLead,
	Conversation,
	ConversationListItem,
	ConversationStatus,
	ConversationMode,
	ConversationWithTurns,
	CreateAgent,
	CreateKbArticle,
	CreateLlmCredential,
	CreateOrganization,
	EndConversation,
	HumanMessage,
	InviteMember,
	KbArticle,
	KbArticleListItem,
	Lead,
	MembershipWithUser,
	Organization,
	OrganizationWithMembers,
	OrgLlmCredentialPublic,
	SetAgentCredentialOverride,
	StartWidgetConversationResponse,
	TakeOverResponse,
	UpdateAgent,
	UpdateKbArticle,
	UpdateLead,
	UpdateOrganization,
	Visitor,
	WidgetConfig,
} from "@leadly/schemas";

export type ClientOptions = {
	baseUrl: string;
	// Optional accessor for the auth token (Bearer header). The dashboard
	// runs cookie-based auth via Better Auth, so this stays unused there;
	// future native + widget clients pass a getter.
	getToken?: () => string | null | undefined;
	// Override fetch for tests. Defaults to globalThis.fetch.
	fetch?: typeof fetch;
};

export class LeadlyApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly bodyText: string,
		message?: string,
	) {
		super(message ?? `API error ${status}`);
	}
}

export function createLeadlyClient(opts: ClientOptions) {
	const fetcher = opts.fetch ?? globalThis.fetch.bind(globalThis);

	async function request<T>(
		method: string,
		path: string,
		body?: unknown,
		query?: Record<string, string | number | undefined>,
	): Promise<T> {
		const url = new URL(opts.baseUrl + path);
		if (query) {
			for (const [k, v] of Object.entries(query)) {
				if (v !== undefined) url.searchParams.set(k, String(v));
			}
		}
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		const tok = opts.getToken?.();
		if (tok) headers.authorization = `Bearer ${tok}`;

		const res = await fetcher(url.toString(), {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			credentials: "include",
		});

		// 204 / empty bodies are normal for DELETEs; we still try to parse
		// the body but tolerate empty.
		const text = await res.text();
		if (!res.ok) {
			throw new LeadlyApiError(res.status, text);
		}
		if (text.length === 0) return undefined as T;
		try {
			return JSON.parse(text) as T;
		} catch {
			throw new LeadlyApiError(res.status, text, "Non-JSON response");
		}
	}

	return {
		// ---------- orgs ----------
		orgs: {
			list: () => request<Organization[]>("GET", "/api/orgs"),
			create: (body: CreateOrganization) =>
				request<Organization>("POST", "/api/orgs", body),
			get: (orgId: string) =>
				request<OrganizationWithMembers>("GET", `/api/orgs/${orgId}`),
			update: (orgId: string, body: UpdateOrganization) =>
				request<Organization>("PATCH", `/api/orgs/${orgId}`, body),
			invite: (orgId: string, body: InviteMember) =>
				request<MembershipWithUser>(
					"POST",
					`/api/orgs/${orgId}/members`,
					body,
				),
			removeMember: (orgId: string, userId: string) =>
				request<{ success: true }>(
					"DELETE",
					`/api/orgs/${orgId}/members/${userId}`,
				),
		},

		// ---------- agents ----------
		agents: {
			list: (orgId: string) =>
				request<Agent[]>("GET", `/api/orgs/${orgId}/agents`),
			create: (orgId: string, body: CreateAgent) =>
				request<Agent>("POST", `/api/orgs/${orgId}/agents`, body),
			get: (agentId: string) =>
				request<Agent>("GET", `/api/agents/${agentId}`),
			update: (agentId: string, body: UpdateAgent) =>
				request<Agent>("PATCH", `/api/agents/${agentId}`, body),
			delete: (agentId: string) =>
				request<{ success: true }>("DELETE", `/api/agents/${agentId}`),
		},

		// ---------- kb ----------
		kb: {
			list: (agentId: string) =>
				request<KbArticleListItem[]>(
					"GET",
					`/api/agents/${agentId}/kb/articles`,
				),
			get: (agentId: string, articleId: string) =>
				request<KbArticle>(
					"GET",
					`/api/agents/${agentId}/kb/articles/${articleId}`,
				),
			create: (agentId: string, body: CreateKbArticle) =>
				request<KbArticle>(
					"POST",
					`/api/agents/${agentId}/kb/articles`,
					body,
				),
			update: (
				agentId: string,
				articleId: string,
				body: UpdateKbArticle,
			) =>
				request<KbArticle>(
					"PATCH",
					`/api/agents/${agentId}/kb/articles/${articleId}`,
					body,
				),
			delete: (agentId: string, articleId: string) =>
				request<{ success: true }>(
					"DELETE",
					`/api/agents/${agentId}/kb/articles/${articleId}`,
				),
			// Upload uses multipart/form-data — separate path from the
			// JSON-only request() helper.
			upload: async (
				agentId: string,
				file: Blob,
				title: string,
			): Promise<KbArticle> => {
				const url = new URL(
					opts.baseUrl + `/api/agents/${agentId}/kb/articles/upload`,
				);
				const form = new FormData();
				form.append("file", file);
				form.append("title", title);
				const headers: Record<string, string> = {};
				const tok = opts.getToken?.();
				if (tok) headers.authorization = `Bearer ${tok}`;
				const res = await fetcher(url.toString(), {
					method: "POST",
					headers,
					body: form,
					credentials: "include",
				});
				const text = await res.text();
				if (!res.ok) throw new LeadlyApiError(res.status, text);
				return JSON.parse(text) as KbArticle;
			},
		},

		// ---------- visitors / leads ----------
		visitors: {
			list: (agentId: string, params?: { limit?: number }) =>
				request<Visitor[]>(
					"GET",
					`/api/agents/${agentId}/visitors`,
					undefined,
					params,
				),
			get: (visitorId: string) =>
				request<Visitor>("GET", `/api/visitors/${visitorId}`),
		},
		leads: {
			list: (agentId: string, params?: { limit?: number; search?: string }) =>
				request<Lead[]>(
					"GET",
					`/api/agents/${agentId}/leads`,
					undefined,
					params,
				),
			get: (leadId: string) => request<Lead>("GET", `/api/leads/${leadId}`),
			update: (leadId: string, body: UpdateLead) =>
				request<Lead>("PATCH", `/api/leads/${leadId}`, body),
			delete: (leadId: string) =>
				request<{ success: true }>("DELETE", `/api/leads/${leadId}`),
		},

		// ---------- conversations / inbox ----------
		conversations: {
			list: (
				agentId: string,
				params?: {
					cursor?: string;
					limit?: number;
					status?: ConversationStatus;
					mode?: ConversationMode;
					leadId?: string;
				},
			) =>
				request<{
					items: ConversationListItem[];
					nextCursor: string | null;
				}>(
					"GET",
					`/api/agents/${agentId}/conversations`,
					undefined,
					params,
				),
			get: (id: string) =>
				request<ConversationWithTurns>("GET", `/api/conversations/${id}`),
			takeOver: (id: string) =>
				request<TakeOverResponse>(
					"POST",
					`/api/conversations/${id}/take-over`,
				),
			release: (id: string) =>
				request<{ success: true }>(
					"POST",
					`/api/conversations/${id}/release`,
				),
			humanMessage: (id: string, body: HumanMessage) =>
				request<{ success: true }>(
					"POST",
					`/api/conversations/${id}/human-message`,
					body,
				),
			end: (id: string, body: EndConversation = {}) =>
				request<{ success: true }>(
					"POST",
					`/api/conversations/${id}/end`,
					body,
				),
		},

		// ---------- analytics ----------
		analytics: {
			summary: (agentId: string, params?: { windowDays?: number }) =>
				request<AnalyticsSummary>(
					"GET",
					`/api/agents/${agentId}/analytics/summary`,
					undefined,
					params,
				),
			timeseries: (agentId: string, params?: { windowDays?: number }) =>
				request<AnalyticsTimeseries>(
					"GET",
					`/api/agents/${agentId}/analytics/timeseries`,
					undefined,
					params,
				),
		},

		// ---------- byok ----------
		byok: {
			list: (orgId: string) =>
				request<OrgLlmCredentialPublic[]>(
					"GET",
					`/api/orgs/${orgId}/credentials`,
				),
			create: (orgId: string, body: CreateLlmCredential) =>
				request<OrgLlmCredentialPublic>(
					"POST",
					`/api/orgs/${orgId}/credentials`,
					body,
				),
			delete: (orgId: string, credentialId: string) =>
				request<{ success: true }>(
					"DELETE",
					`/api/orgs/${orgId}/credentials/${credentialId}`,
				),
			setAgentOverride: (
				agentId: string,
				body: SetAgentCredentialOverride,
			) =>
				request<{ success: true }>(
					"POST",
					`/api/agents/${agentId}/credential-override`,
					body,
				),
			clearAgentOverride: (agentId: string) =>
				request<{ success: true }>(
					"DELETE",
					`/api/agents/${agentId}/credential-override`,
				),
		},

		// ---------- widget (used by the widget app, not the dashboard) ----------
		widget: {
			config: (agentId: string) =>
				request<WidgetConfig>(
					"GET",
					`/api/widget/config`,
					undefined,
					{ agentId },
				),
			visitor: (
				agentId: string,
				body: { externalId: string; userAgent?: string },
			) =>
				request<{ visitorId: string; token: string }>(
					"POST",
					`/api/widget/visitor`,
					body,
					{ agentId },
				),
			startConversation: () =>
				request<StartWidgetConversationResponse>(
					"POST",
					`/api/widget/conversation`,
					{},
				),
		},
	};
}

export type LeadlyClient = ReturnType<typeof createLeadlyClient>;

// Re-exports of the most commonly used schema-derived types so dashboard
// code can `import type { Agent } from "@leadly/api-client"` without
// reaching into @leadly/schemas directly. Keeps the import surface
// narrower for the typical "list + form" page.
export type {
	Agent,
	AnalyticsSummary,
	AnalyticsTimeseries,
	CaptureLead,
	Conversation,
	ConversationListItem,
	ConversationWithTurns,
	CreateAgent,
	CreateKbArticle,
	KbArticle,
	KbArticleListItem,
	Lead,
	Organization,
	OrganizationWithMembers,
	UpdateAgent,
	Visitor,
};
