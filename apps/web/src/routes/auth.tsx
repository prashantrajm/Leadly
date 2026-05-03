import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth")({
	component: AuthPage,
});

const signInSchema = z.object({
	email: z.string().email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

const signUpSchema = z.object({
	name: z.string().min(2, "Tell us your name"),
	email: z.string().email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

function AuthPage() {
	return (
		<div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-2">
			<VisualPane />
			<FormPane />
		</div>
	);
}

function VisualPane() {
	return (
		<div className="relative hidden overflow-hidden border-r border-border/60 bg-card lg:block">
			{/* Dot grid */}
			<div
				aria-hidden
				className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:24px_24px] opacity-40"
			/>
			{/* Soft top glow */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] bg-[radial-gradient(circle_at_50%_0%,var(--color-foreground)_0%,transparent_55%)] opacity-[0.06] blur-3xl"
			/>

			<div className="relative flex h-full flex-col justify-between p-12">
				<Link
					to="/"
					className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
				>
					<span className="inline-block h-2 w-2 rounded-full bg-foreground" />
					Leadly
				</Link>

				<FauxChat />

				<div className="max-w-sm">
					<p className="text-sm leading-relaxed text-muted-foreground">
						"Drop a script on the site, write five articles. By Tuesday we
						stopped getting the same shipping question for the tenth time."
					</p>
					<div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
						— Maya P., Northbeam
					</div>
				</div>
			</div>
		</div>
	);
}

function FauxChat() {
	return (
		<div className="my-12 flex max-w-md flex-col gap-3">
			<ChatBubble side="left">Hey, do you ship to Canada?</ChatBubble>
			<ChatBubble side="right">
				Yes — Canada-wide is $12 flat, 3–5 business days.
			</ChatBubble>
			<ChatBubble side="left">Cool. Can I bundle two and save?</ChatBubble>
			<ChatBubble side="right" human>
				Hey! Quick yes — bundle of two saves you 15%.
			</ChatBubble>
		</div>
	);
}

function ChatBubble({
	side,
	human,
	children,
}: {
	side: "left" | "right";
	human?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`flex ${side === "left" ? "justify-start" : "justify-end"}`}
		>
			<div
				className={`relative max-w-[78%] rounded-2xl px-4 py-2 text-sm ${
					side === "left"
						? "rounded-bl-sm bg-secondary text-secondary-foreground"
						: "rounded-br-sm bg-foreground text-background"
				}`}
			>
				{children}
				{human && (
					<span className="pointer-events-none absolute -top-2 -right-2 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground">
						human
					</span>
				)}
			</div>
		</div>
	);
}

function FormPane() {
	const [tab, setTab] = useState<"signin" | "signup">("signin");

	return (
		<div className="flex items-center justify-center px-4 py-12 sm:px-8 md:py-16">
			<div className="w-full max-w-md">
				<div className="mb-8 lg:hidden">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
					>
						<span className="inline-block h-2 w-2 rounded-full bg-foreground" />
						Leadly
					</Link>
				</div>

				<div className="mb-8">
					<h1 className="text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
						{tab === "signin" ? "Welcome back." : "Create your account."}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{tab === "signin"
							? "Sign in to continue to your dashboard."
							: "Five-minute setup, free during preview."}
					</p>
				</div>

				<div className="rounded-2xl border border-border bg-card p-6 md:p-8">
					<GoogleButton />

					<div className="my-6 flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							or with email
						</span>
						<div className="h-px flex-1 bg-border" />
					</div>

					<Tabs
						value={tab}
						onValueChange={(v) => setTab(v as "signin" | "signup")}
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="signin">Sign in</TabsTrigger>
							<TabsTrigger value="signup">Sign up</TabsTrigger>
						</TabsList>
						<TabsContent value="signin" className="mt-5">
							<SignInForm />
						</TabsContent>
						<TabsContent value="signup" className="mt-5">
							<SignUpForm />
						</TabsContent>
					</Tabs>
				</div>

				<p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
					By continuing you agree to our{" "}
					<Link
						to="/terms-and-conditions"
						className="text-foreground underline-offset-4 hover:underline"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						to="/privacy-policy"
						className="text-foreground underline-offset-4 hover:underline"
					>
						Privacy Policy
					</Link>
					.
				</p>
			</div>
		</div>
	);
}

function GoogleButton() {
	const [loading, setLoading] = useState(false);
	return (
		<Button
			variant="outline"
			className="h-11 w-full"
			disabled={loading}
			onClick={async () => {
				setLoading(true);
				try {
					await authClient.signIn.social({
						provider: "google",
						callbackURL: window.location.origin,
					});
				} finally {
					setLoading(false);
				}
			}}
		>
			{loading ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<GoogleGlyph />
			)}
			Continue with Google
		</Button>
	);
}

function GoogleGlyph() {
	return (
		<svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
			<title>Google</title>
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function SignInForm() {
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const form = useForm<z.infer<typeof signInSchema>>({
		resolver: zodResolver(signInSchema),
		defaultValues: { email: "", password: "" },
	});

	async function onSubmit(values: z.infer<typeof signInSchema>) {
		setError(null);
		setSubmitting(true);
		try {
			const res = await authClient.signIn.email({
				email: values.email,
				password: values.password,
				callbackURL: window.location.origin,
			});
			if (res?.error) {
				setError(res.error.message ?? "Could not sign in.");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not sign in.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				{error && (
					<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</div>
				)}
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input
									type="email"
									autoComplete="email"
									placeholder="you@company.com"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<div className="flex items-center justify-between">
								<FormLabel>Password</FormLabel>
								<a
									href="#"
									className="text-xs text-muted-foreground hover:text-foreground"
								>
									Forgot?
								</a>
							</div>
							<FormControl>
								<Input
									type="password"
									autoComplete="current-password"
									placeholder="••••••••"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="h-11 w-full" disabled={submitting}>
					{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Sign in
				</Button>
			</form>
		</Form>
	);
}

function SignUpForm() {
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const form = useForm<z.infer<typeof signUpSchema>>({
		resolver: zodResolver(signUpSchema),
		defaultValues: { name: "", email: "", password: "" },
	});

	async function onSubmit(values: z.infer<typeof signUpSchema>) {
		setError(null);
		setSubmitting(true);
		try {
			const res = await authClient.signUp.email({
				name: values.name,
				email: values.email,
				password: values.password,
				callbackURL: window.location.origin,
			});
			if (res?.error) {
				setError(res.error.message ?? "Could not create account.");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create account.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				{error && (
					<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</div>
				)}
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input
									autoComplete="name"
									placeholder="Maya Patel"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input
									type="email"
									autoComplete="email"
									placeholder="you@company.com"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Password</FormLabel>
							<FormControl>
								<Input
									type="password"
									autoComplete="new-password"
									placeholder="At least 8 characters"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="h-11 w-full" disabled={submitting}>
					{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Create account
				</Button>
			</form>
		</Form>
	);
}
