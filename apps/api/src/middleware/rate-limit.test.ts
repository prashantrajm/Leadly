import { describe, expect, it } from "bun:test";
import { consumeToken } from "./rate-limit";

// Tiny in-memory KV stand-in. Real KVNamespace exposes more methods than
// we need; consumeToken only ever calls .get and .put.
function makeFakeKv() {
	const store = new Map<string, { value: string; expiresAt: number | null }>();
	const ns = {
		get: async (k: string) => {
			const e = store.get(k);
			if (!e) return null;
			if (e.expiresAt && Date.now() >= e.expiresAt) {
				store.delete(k);
				return null;
			}
			return e.value;
		},
		put: async (
			k: string,
			v: string,
			opts?: { expirationTtl?: number },
		) => {
			store.set(k, {
				value: v,
				expiresAt: opts?.expirationTtl
					? Date.now() + opts.expirationTtl * 1000
					: null,
			});
		},
	};
	return { store, ns: ns as unknown as KVNamespace };
}

describe("consumeToken", () => {
	it("allows up to max in a window", async () => {
		const kv = makeFakeKv().ns;
		for (let i = 0; i < 3; i++) {
			const r = await consumeToken(
				{ kv, bucket: "rl:test", windowSeconds: 60, max: 3 },
				"visitor-1",
			);
			expect(r.allowed).toBe(true);
		}
	});

	it("denies the first request past max", async () => {
		const kv = makeFakeKv().ns;
		for (let i = 0; i < 3; i++) {
			await consumeToken(
				{ kv, bucket: "rl:test", windowSeconds: 60, max: 3 },
				"v1",
			);
		}
		const r = await consumeToken(
			{ kv, bucket: "rl:test", windowSeconds: 60, max: 3 },
			"v1",
		);
		expect(r.allowed).toBe(false);
		expect(r.remaining).toBe(0);
	});

	it("isolates subjects (different visitors don't share a bucket)", async () => {
		const kv = makeFakeKv().ns;
		for (let i = 0; i < 3; i++) {
			await consumeToken(
				{ kv, bucket: "rl:test", windowSeconds: 60, max: 3 },
				"v1",
			);
		}
		const r = await consumeToken(
			{ kv, bucket: "rl:test", windowSeconds: 60, max: 3 },
			"v2",
		);
		expect(r.allowed).toBe(true);
	});

	it("resets the bucket after the window expires", async () => {
		const kv = makeFakeKv().ns;
		// Advance our injected clock instead of waiting wall time.
		let clock = 1_700_000_000_000;
		const opts = {
			kv,
			bucket: "rl:test",
			windowSeconds: 60,
			max: 2,
			now: () => clock,
		};
		await consumeToken(opts, "v1");
		await consumeToken(opts, "v1");
		expect((await consumeToken(opts, "v1")).allowed).toBe(false);

		// Move past the window — counter resets.
		clock += 61_000;
		const r = await consumeToken(opts, "v1");
		expect(r.allowed).toBe(true);
	});

	it("returns remaining = max - count on a fresh allowed request", async () => {
		const kv = makeFakeKv().ns;
		const r = await consumeToken(
			{ kv, bucket: "rl:test", windowSeconds: 60, max: 5 },
			"v1",
		);
		expect(r.remaining).toBe(4);
	});
});
