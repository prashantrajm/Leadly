// Pure unit test — the Prisma client is stubbed, no database involved.
import { describe, expect, it } from "bun:test";
import { checkSlugAvailability, pickAvailableSlug } from "./org-slug";

function stubPrisma(takenSlugs: string[]) {
	const calls: string[] = [];
	const prisma = {
		organization: {
			findUnique: async ({ where }: { where: { slug: string } }) => {
				calls.push(where.slug);
				return takenSlugs.includes(where.slug) ? { id: "x" } : null;
			},
		},
	} as unknown as Parameters<typeof pickAvailableSlug>[0];
	return { prisma, calls };
}

describe("pickAvailableSlug", () => {
	it("keeps a free slug as-is", async () => {
		const { prisma } = stubPrisma([]);
		expect(await pickAvailableSlug(prisma, "acme")).toBe("acme");
	});

	it("suffixes a taken slug", async () => {
		const { prisma } = stubPrisma(["acme"]);
		expect(await pickAvailableSlug(prisma, "acme")).toMatch(/^acme-[a-z0-9]+$/);
	});

	it("suffixes a reserved slug without looking it up", async () => {
		const { prisma, calls } = stubPrisma([]);
		expect(await pickAvailableSlug(prisma, "pricing")).toMatch(/^pricing-[a-z0-9]+$/);
		expect(calls).toEqual([]);
	});
});

describe("checkSlugAvailability", () => {
	function stub(taken: string[]) {
		return {
			organization: {
				findUnique: async ({ where }: { where: { slug: string } }) =>
					taken.includes(where.slug) ? { id: "x" } : null,
				findMany: async ({ where }: { where: { slug: { in: string[] } } }) =>
					where.slug.in.filter((s) => taken.includes(s)).map((slug) => ({ slug })),
			},
		} as unknown as Parameters<typeof checkSlugAvailability>[0];
	}

	it("reports a free slug as available", async () => {
		expect(await checkSlugAvailability(stub([]), "acme")).toEqual({
			slug: "acme",
			available: true,
			reason: null,
			suggestion: null,
		});
	});

	it("suggests the next free numbered slug when taken", async () => {
		const res = await checkSlugAvailability(stub(["acme", "acme-2"]), "acme");
		expect(res).toMatchObject({ available: false, reason: "taken", suggestion: "acme-3" });
	});

	it("flags reserved slugs and suggests an alternative", async () => {
		const res = await checkSlugAvailability(stub([]), "pricing");
		expect(res).toMatchObject({ available: false, reason: "reserved", suggestion: "pricing-2" });
	});

	it("flags malformed slugs and suggests a cleaned-up one", async () => {
		const res = await checkSlugAvailability(stub([]), "Acme Inc!");
		expect(res).toMatchObject({ available: false, reason: "invalid", suggestion: "acme-inc" });
	});
});
