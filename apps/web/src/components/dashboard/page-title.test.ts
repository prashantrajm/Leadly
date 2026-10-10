import { describe, expect, it } from "vitest";
import { titleFor } from "./page-title";

const names: Record<string, string> = { a1: "Suri" };
const agentName = (id: string) => names[id];

describe("titleFor", () => {
	it.each([
		["/acme", ["Overview"]],
		["/acme/", ["Overview"]],
		["/acme/inbox", ["Inbox"]],
		["/acme/inbox/c1", ["Inbox", "Conversation"]],
		["/acme/leads", ["Leads"]],
		["/acme/visitors", ["Visitors"]],
		["/acme/analytics", ["Analytics"]],
		["/acme/agents", ["Agents"]],
		["/acme/settings", ["Settings"]],
		["/acme/settings/profile", ["Settings", "Profile"]],
		["/acme/agents/a1", ["Suri"]],
		["/acme/agents/a1/install", ["Suri", "Install"]],
		[
			"/acme/agents/a1/knowledge/new",
			["Suri", "Knowledge", "New article"],
		],
		["/acme/agents/a1/knowledge/art1", ["Suri", "Knowledge", "Article"]],
		["/acme/agents/unknown/playground", ["Agent", "Playground"]],
	])("%s → %j", (pathname, expected) => {
		expect(titleFor(pathname, agentName)).toEqual(expected);
	});
});
