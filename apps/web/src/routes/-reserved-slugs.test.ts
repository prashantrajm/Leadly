// Workspaces live at /<orgSlug>/…, and static routes win over the slug. If a
// top-level page isn't in RESERVED_ORG_SLUGS, an org could be given that slug
// and its dashboard would be unreachable. Add new pages to the list in
// packages/schemas/src/org.ts.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isReservedOrgSlug } from "@leadly/schemas";
import { describe, expect, it } from "vitest";

const routesDir = fileURLToPath(new URL(".", import.meta.url));

function topLevelSegments(): string[] {
	return readdirSync(routesDir)
		.filter((name) => !name.startsWith("-"))
		.map((name) => name.replace(/\.tsx?$/, "").split(".")[0])
		.filter(
			(seg) =>
				seg && !seg.startsWith("__") && !seg.startsWith("$") && seg !== "index",
		);
}

describe("reserved org slugs", () => {
	it("cover every top-level web route", () => {
		const segments = [...new Set(topLevelSegments())];
		expect(segments.length).toBeGreaterThan(5);
		expect(segments.filter((seg) => !isReservedOrgSlug(seg))).toEqual([]);
	});
});
