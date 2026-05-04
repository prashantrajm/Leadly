// One-off verification script for the Phase 2 init migration.
// Confirms: vector extension installed, HNSW index on kb_chunk.embedding,
// partial unique indexes on (lead.agentId, email) and (lead.agentId, phone),
// and that every domain table is present.

import { getPrisma } from "../src/lib/prisma";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL not set — run via dotenv.");
	process.exit(1);
}

const prisma = getPrisma(url);

const ext = await prisma.$queryRawUnsafe<
	{ extname: string; extversion: string }[]
>(`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`);
console.log("vector ext:", ext);

const idx = await prisma.$queryRawUnsafe<{
	indexname: string;
	indexdef: string;
}[]>(
	`SELECT indexname, indexdef FROM pg_indexes
   WHERE schemaname = 'public'
     AND (indexname LIKE '%hnsw%' OR indexname LIKE 'lead_agent_%_unique')
   ORDER BY indexname`,
);
console.log("\ncustom indexes:");
for (const i of idx) {
	console.log(" •", i.indexname);
	console.log("   ", i.indexdef);
}

const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
	`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
);
console.log("\ntables:", tables.map((t) => t.tablename).join(", "));

const expected = [
	"_prisma_migrations",
	"account",
	"agent",
	"agent_llm_override",
	"conversation",
	"daily_stat",
	"kb_article",
	"kb_chunk",
	"lead",
	"membership",
	"org_llm_credential",
	"organization",
	"session",
	"tool",
	"turn",
	"user",
	"verification",
	"visitor",
];
const actual = new Set(tables.map((t) => t.tablename));
const missing = expected.filter((t) => !actual.has(t));
if (missing.length > 0) {
	console.error("\nMISSING TABLES:", missing);
	process.exit(1);
}
console.log("\nall expected tables present.");
