import {
	isReservedOrgSlug,
	type OrgSlugAvailability,
	OrgSlugSchema,
} from "@leadly/schemas";
import { slugify } from "@leadly/utils";
import type { getPrisma } from "./prisma";

type Prisma = ReturnType<typeof getPrisma>;

// Pick a slug for a new org. A slug that's taken or reserved (it would
// shadow a top-level web page like /pricing) gets a 6-char random suffix.
// Collisions after the suffix are vanishingly rare; the unique index
// surfaces them as an error rather than us looping.
export async function pickAvailableSlug(prisma: Prisma, base: string) {
	if (!isReservedOrgSlug(base)) {
		const existing = await prisma.organization.findUnique({
			where: { slug: base },
			select: { id: true },
		});
		if (!existing) return base;
	}
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${base}-${suffix}`;
}

// A free slug close to `base`, for "acme is taken — try acme-2". Tries
// base, base-2 … base-9 in one query before falling back to a random
// suffix.
export async function suggestAvailableSlug(prisma: Prisma, base: string) {
	const root = slugify(base).slice(0, 60) || "workspace";
	const candidates = [root, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${root}-${n}`)]
		.filter((s) => OrgSlugSchema.safeParse(s).success);
	const taken = await prisma.organization.findMany({
		where: { slug: { in: candidates } },
		select: { slug: true },
	});
	const takenSet = new Set(taken.map((o) => o.slug));
	return (
		candidates.find((s) => !takenSet.has(s)) ??
		(await pickAvailableSlug(prisma, root))
	);
}

export async function checkSlugAvailability(
	prisma: Prisma,
	slug: string,
): Promise<OrgSlugAvailability> {
	const parsed = OrgSlugSchema.safeParse(slug);
	if (!parsed.success) {
		const reason = isReservedOrgSlug(slug) ? "reserved" : "invalid";
		return {
			slug,
			available: false,
			reason,
			suggestion: await suggestAvailableSlug(prisma, slug),
		};
	}
	const existing = await prisma.organization.findUnique({
		where: { slug },
		select: { id: true },
	});
	if (!existing) return { slug, available: true, reason: null, suggestion: null };
	return {
		slug,
		available: false,
		reason: "taken",
		suggestion: await suggestAvailableSlug(prisma, slug),
	};
}
