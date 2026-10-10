import type { getPrisma } from "./prisma";

type Prisma = ReturnType<typeof getPrisma>;

// Permanently delete an org. The DB row goes first — it cascades to
// memberships, invitations, agents and everything under them (KB, visitors,
// leads, conversations, turns, credentials). Then best-effort cleanup of
// what lives outside Postgres:
//   • R2: KB uploads under org/<orgId>/
//   • KV: each agent's cached widget config (it'd expire in ~60s anyway)
// A cleanup failure doesn't undo the delete; orphaned R2 objects are inert.
export async function deleteOrganizationCompletely(
	prisma: Prisma,
	env: { MEDIA_BUCKET: R2Bucket; WIDGET_CACHE: KVNamespace },
	orgId: string,
): Promise<void> {
	const agents = await prisma.agent.findMany({
		where: { organizationId: orgId },
		select: { id: true },
	});

	await prisma.organization.delete({ where: { id: orgId } });

	await Promise.allSettled([
		deleteR2Prefix(env.MEDIA_BUCKET, `org/${orgId}/`),
		...agents.map((a) => env.WIDGET_CACHE.delete(`widget:config:${a.id}`)),
	]);
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string) {
	let cursor: string | undefined;
	do {
		const page = await bucket.list({ prefix, cursor });
		if (page.objects.length > 0) {
			await bucket.delete(page.objects.map((o) => o.key));
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
}
