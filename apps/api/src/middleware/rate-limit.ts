// Token-bucket rate limiter backed by Workers KV.
//
// Per design §5.6 we use KV (eventually consistent) for visitor abuse
// counters — accepting that two concurrent requests across edges might
// both squeeze through is a fine trade-off for the simplicity of not
// running a global Redis. The blast radius of a brief over-limit is
// "one extra agent reply"; the cost of strong consistency would be a
// new piece of infra.
//
// Default: 30 messages per minute per (agentId, visitorId). The
// dashboard-facing routes don't use this — only widget surfaces.

export type RateLimitResult =
	| { allowed: true; remaining: number; resetAt: number }
	| { allowed: false; remaining: 0; resetAt: number };

export type RateLimitOptions = {
	kv: KVNamespace;
	bucket: string; // keyspace prefix, e.g. "rl:widget:msg"
	windowSeconds: number;
	max: number;
	now?: () => number;
};

// Shape stored in KV — counter + window start. Window slides only when
// the previous one expires.
type Cell = { count: number; resetAt: number };

export async function consumeToken(
	opts: RateLimitOptions,
	subject: string,
): Promise<RateLimitResult> {
	const now = opts.now?.() ?? Date.now();
	const key = `${opts.bucket}:${subject}`;

	const raw = await opts.kv.get(key);
	let cell: Cell | null = raw ? safeJson<Cell>(raw) : null;

	if (!cell || cell.resetAt <= now) {
		cell = { count: 0, resetAt: now + opts.windowSeconds * 1000 };
	}

	if (cell.count >= opts.max) {
		return { allowed: false, remaining: 0, resetAt: cell.resetAt };
	}

	cell.count += 1;
	// expirationTtl is seconds. Round up so we never expire a counter mid-window.
	const ttl = Math.max(1, Math.ceil((cell.resetAt - now) / 1000));
	await opts.kv.put(key, JSON.stringify(cell), { expirationTtl: ttl });

	return {
		allowed: true,
		remaining: opts.max - cell.count,
		resetAt: cell.resetAt,
	};
}

function safeJson<T>(s: string): T | null {
	try {
		return JSON.parse(s) as T;
	} catch {
		return null;
	}
}
