// Retrieval test against the real DB. We seed kb_chunk rows with handcrafted
// 1536-dim vectors so cosine distances are deterministic, then assert the
// query returns the expected ordering. No OpenRouter call needed.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getPrisma } from "./prisma";
import { EMBEDDING_DIM } from "./embeddings";
import { retrieveTopK } from "./retrieval";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);

const tag = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let userId: string;
let orgId: string;
let agentId: string;
let otherAgentId: string;
let articleId: string;

// Build a 1536-dim unit vector pointing in a single canonical direction.
// Index `dim` is set to 1; everything else is 0.
function unitVec(dim: number): number[] {
	const v = new Array(EMBEDDING_DIM).fill(0);
	v[dim] = 1;
	return v;
}

function literal(v: number[]): string {
	return `[${v.join(",")}]`;
}

beforeAll(async () => {
	userId = `${tag}-u`;
	await prisma.user.create({
		data: {
			id: userId,
			name: userId,
			email: `${userId}@test.local`,
			emailVerified: true,
		},
	});
	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId, role: "owner" } },
		},
	});
	orgId = org.id;
	const agent = await prisma.agent.create({
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;

	// Second agent in the same org, used to verify per-agent isolation.
	const other = await prisma.agent.create({
		data: {
			organizationId: orgId,
			name: `Other ${tag}`,
			slug: `o-${tag}`,
		},
	});
	otherAgentId = other.id;

	const article = await prisma.kbArticle.create({
		data: {
			organizationId: orgId,
			agentId,
			title: "Vector Test Article",
			contentMarkdown: "ignored — chunks are inserted directly.",
		},
	});
	articleId = article.id;

	const otherArticle = await prisma.kbArticle.create({
		data: {
			organizationId: orgId,
			agentId: otherAgentId,
			title: "Other Agent Article",
			contentMarkdown: "should never be returned for our agent",
		},
	});

	// Three chunks for the test agent, each with a distinct unit-vector
	// direction. Whichever direction the query targets becomes the nearest
	// neighbour (distance 0).
	const inserts: Array<{ id: string; ord: number; vec: number[] }> = [
		{ id: `${tag}-c0`, ord: 0, vec: unitVec(0) },
		{ id: `${tag}-c1`, ord: 1, vec: unitVec(1) },
		{ id: `${tag}-c2`, ord: 2, vec: unitVec(2) },
	];
	for (const ins of inserts) {
		await prisma.$executeRawUnsafe(
			`INSERT INTO "kb_chunk" ("id","organizationId","agentId","articleId","ord","text","tokens","embedding","createdAt")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector,NOW())`,
			ins.id,
			orgId,
			agentId,
			articleId,
			ins.ord,
			`chunk #${ins.ord}`,
			3,
			literal(ins.vec),
		);
	}

	// One chunk on the OTHER agent that's identical to query direction 0 —
	// retrieval must NOT return it for our agent.
	await prisma.$executeRawUnsafe(
		`INSERT INTO "kb_chunk" ("id","organizationId","agentId","articleId","ord","text","tokens","embedding","createdAt")
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector,NOW())`,
		`${tag}-other`,
		orgId,
		otherAgentId,
		otherArticle.id,
		0,
		"sneaky cross-agent chunk",
		3,
		literal(unitVec(0)),
	);
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("retrieveTopK", () => {
	it("orders chunks by cosine distance (closest first)", async () => {
		// Query in direction 1: chunk c1 should win (distance 0), then c0
		// and c2 are equidistant (distance 1, orthogonal).
		const result = await retrieveTopK(DATABASE_URL, agentId, unitVec(1), 5);
		expect(result.length).toBeGreaterThanOrEqual(3);
		expect(result[0].chunkId).toBe(`${tag}-c1`);
		expect(result[0].distance).toBeLessThan(0.0001);
		// Following two should be the orthogonal ones, distance ~1.
		for (const r of result.slice(1, 3)) {
			expect(r.distance).toBeGreaterThan(0.99);
			expect(r.distance).toBeLessThan(1.01);
		}
	});

	it("respects k", async () => {
		const result = await retrieveTopK(DATABASE_URL, agentId, unitVec(0), 1);
		expect(result).toHaveLength(1);
		expect(result[0].chunkId).toBe(`${tag}-c0`);
	});

	it("never returns chunks from other agents", async () => {
		// The other agent's chunk has the SAME vector as ours at direction 0,
		// and it's the only one matching exactly — if our agent filter were
		// missing, the other agent's chunk would tie with c0.
		const result = await retrieveTopK(DATABASE_URL, agentId, unitVec(0), 10);
		for (const r of result) {
			expect(r.chunkId).not.toBe(`${tag}-other`);
		}
	});

	it("attaches the article title for citation", async () => {
		const result = await retrieveTopK(DATABASE_URL, agentId, unitVec(0), 1);
		expect(result[0].articleId).toBe(articleId);
		expect(result[0].articleTitle).toBe("Vector Test Article");
	});

	it("rejects wrong-dim embeddings", async () => {
		await expect(retrieveTopK(DATABASE_URL, agentId, [1, 2, 3], 5)).rejects.toThrow(
			/dim/,
		);
	});
});
