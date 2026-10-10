import { describe, expect, it } from "vitest";
import { titleFor } from "./page-title";

const names: Record<string, string> = { a1: "Suri" };
const agentName = (id: string) => names[id];

describe("titleFor", () => {
	it.each([
		["/dashboard", ["Overview"]],
		["/dashboard/", ["Overview"]],
		["/dashboard/inbox", ["Inbox"]],
		["/dashboard/inbox/c1", ["Inbox", "Conversation"]],
		["/dashboard/leads", ["Leads"]],
		["/dashboard/visitors", ["Visitors"]],
		["/dashboard/analytics", ["Analytics"]],
		["/dashboard/agents", ["Agents"]],
		["/dashboard/settings", ["Settings"]],
		["/dashboard/settings/profile", ["Settings", "Profile"]],
		["/dashboard/agents/a1", ["Suri"]],
		["/dashboard/agents/a1/install", ["Suri", "Install"]],
		[
			"/dashboard/agents/a1/knowledge/new",
			["Suri", "Knowledge", "New article"],
		],
		["/dashboard/agents/a1/knowledge/art1", ["Suri", "Knowledge", "Article"]],
		["/dashboard/agents/unknown/playground", ["Agent", "Playground"]],
	])("%s → %j", (pathname, expected) => {
		expect(titleFor(pathname, agentName)).toEqual(expected);
	});
});
