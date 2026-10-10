import type { Organization } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage, LeadlyApiError } from "@/lib/api";
import { authClient, getCachedSession, useSession } from "@/lib/auth-client";

// Landing page for an invite link. Signed-out visitors go through sign-in
// or sign-up and come straight back here (auth honours ?redirect=).
export const Route = createFileRoute("/invite/$token")({
	beforeLoad: async ({ location }) => {
		const session = await getCachedSession();
		if (!session.data?.user) {
			throw redirect({ to: "/auth", search: { redirect: location.pathname } });
		}
	},
	component: InvitePage,
});

function InvitePage() {
	const { token } = Route.useParams();
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const preview = useQuery({
		queryKey: ["invitation", token],
		queryFn: () => api.invitations.preview(token),
		retry: false,
	});

	const accept = useMutation({
		mutationFn: () => api.invitations.accept(token),
		onSuccess: (org) => {
			queryClient.setQueryData<Organization[]>(["orgs"], (orgs) =>
				orgs?.some((o) => o.id === org.id) ? orgs : [...(orgs ?? []), org],
			);
			queryClient.invalidateQueries({ queryKey: ["orgs"] });
			navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
		},
	});

	async function switchAccount() {
		await authClient.signOut();
		window.location.href = `/auth?redirect=${encodeURIComponent(`/invite/${token}`)}`;
	}

	if (preview.isLoading) {
		return (
			<Shell>
				<Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
			</Shell>
		);
	}

	if (preview.isError || !preview.data) {
		const notFound =
			preview.error instanceof LeadlyApiError && preview.error.status === 404;
		return (
			<Shell
				title={notFound ? "Invite link not valid" : "Couldn't load this invite"}
			>
				<p>
					{notFound
						? "This link doesn't match any invitation. Ask whoever invited you for a new one."
						: apiErrorMessage(preview.error)}
				</p>
				<HomeButton />
			</Shell>
		);
	}

	const inv = preview.data;
	const workspaceLink = (
		<Button
			asChild
			className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
		>
			<Link to="/$orgSlug" params={{ orgSlug: inv.organization.slug }}>
				Open {inv.organization.name}
			</Link>
		</Button>
	);

	if (inv.alreadyMember) {
		return (
			<Shell title={`You're already in ${inv.organization.name}`}>
				{workspaceLink}
			</Shell>
		);
	}

	if (inv.status !== "pending") {
		const why = {
			accepted: "This invitation has already been used.",
			revoked: "This invitation was revoked.",
			expired: "This invitation has expired.",
		}[inv.status];
		return (
			<Shell title="Invitation no longer valid">
				<p>
					{why} Ask an admin of {inv.organization.name} for a new link.
				</p>
				<HomeButton />
			</Shell>
		);
	}

	if (!inv.emailMatches) {
		return (
			<Shell title="This invite is for someone else">
				<p>
					It was sent to{" "}
					<span className="font-medium text-foreground">{inv.email}</span>, but
					you're signed in as{" "}
					<span className="font-medium text-foreground">
						{session?.user?.email}
					</span>
					. Sign in with the invited email to accept.
				</p>
				<Button variant="outline" onClick={switchAccount}>
					Switch account
				</Button>
			</Shell>
		);
	}

	return (
		<Shell title={`Join ${inv.organization.name}`}>
			<p>
				{inv.invitedByName ?? "A teammate"} invited you to join{" "}
				<span className="font-medium text-foreground">
					{inv.organization.name}
				</span>{" "}
				as {inv.role === "admin" ? "an admin" : `a ${inv.role}`}.
			</p>
			{accept.isError && (
				<p className="text-destructive">{apiErrorMessage(accept.error)}</p>
			)}
			<Button
				onClick={() => accept.mutate()}
				disabled={accept.isPending}
				className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
			>
				{accept.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
				Accept invitation
			</Button>
		</Shell>
	);
}

function Shell({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
				{title && (
					<>
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
							<Users className="size-6" />
						</div>
						<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
					</>
				)}
				<div className="mt-3 flex flex-col items-center gap-5 text-sm text-muted-foreground">
					{children}
				</div>
			</div>
		</main>
	);
}

function HomeButton() {
	return (
		<Button asChild variant="outline">
			<Link to="/dashboard">Go to your dashboard</Link>
		</Button>
	);
}
