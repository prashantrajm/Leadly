import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_API_URL?.replace(/\/api$/, ""),
	fetchOptions: {
		credentials: "include",
	},
});

type SessionResult = Awaited<ReturnType<typeof authClient.getSession>>;

let cachedSession: SessionResult | null = null;
let cachedSessionUntil = 0;
let pendingSession: Promise<SessionResult> | null = null;

export async function getCachedSession() {
	const now = Date.now();
	if (cachedSession && now < cachedSessionUntil) {
		return cachedSession;
	}

	if (!pendingSession) {
		pendingSession = authClient.getSession().then((session) => {
			cachedSession = session;
			cachedSessionUntil = Date.now() + 30_000;
			return session;
		}).finally(() => {
			pendingSession = null;
		});
	}

	return pendingSession;
}

export const { signIn, signUp, useSession } = authClient;
