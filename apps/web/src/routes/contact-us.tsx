import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Github, Linkedin, Loader2, Mail, MessageSquare, Twitter } from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact-us")({
	component: ContactPage,
});

const TOPICS = [
	{ value: "sales", label: "Talk to sales" },
	{ value: "support", label: "Product help" },
	{ value: "partnership", label: "Partnership / integration" },
	{ value: "press", label: "Press" },
	{ value: "other", label: "Something else" },
] as const;

const contactSchema = z.object({
	name: z.string().min(2, "Tell us your name"),
	email: z.string().email("Enter a valid email"),
	company: z.string().optional(),
	topic: z.enum(["sales", "support", "partnership", "press", "other"], {
		message: "Pick what this is about",
	}),
	message: z.string().min(20, "A few sentences helps us reply faster"),
});

type ContactValues = z.infer<typeof contactSchema>;

const CONTACT_EMAIL = "hello@leadly.app";

const CHANNELS: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	handle: string;
	href: string;
}[] = [
	{
		icon: Mail,
		label: "Email",
		handle: CONTACT_EMAIL,
		href: `mailto:${CONTACT_EMAIL}`,
	},
	{
		icon: Github,
		label: "GitHub",
		handle: "prashantrajm/Leadly",
		href: "https://github.com/prashantrajm/Leadly",
	},
	{
		icon: Twitter,
		label: "X / Twitter",
		handle: "@leadlyhq",
		href: "https://twitter.com",
	},
	{
		icon: Linkedin,
		label: "LinkedIn",
		handle: "Leadly",
		href: "https://linkedin.com",
	},
	{
		icon: MessageSquare,
		label: "Discord",
		handle: "Community server",
		href: "#",
	},
];

function ContactPage() {
	return (
		<div className="container mx-auto max-w-5xl px-4 py-20 md:py-28">
			<header className="mx-auto mb-14 max-w-2xl text-center md:mb-16">
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					Contact
				</p>
				<h1 className="text-balance text-4xl font-semibold tracking-tighter md:text-5xl">
					Talk to a human.
				</h1>
				<p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
					Sales questions, product help, partnership ideas — drop us a note.
					We'll come back to you in a day or two.
				</p>
			</header>

			<PreviewBanner />

			<div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
				<ContactForm />
				<ChannelsSidebar />
			</div>
		</div>
	);
}

function PreviewBanner() {
	return (
		<div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 px-4 py-3 text-center text-xs text-muted-foreground md:text-sm">
			<span className="font-mono uppercase tracking-[0.18em] text-accent-blue">
				Preview
			</span>{" "}
			· The contact form is live but routed to email while we wire up tickets.
			Replies may take a few days.
		</div>
	);
}

function ContactForm() {
	const [submitted, setSubmitted] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const form = useForm<ContactValues>({
		resolver: zodResolver(contactSchema),
		defaultValues: {
			name: "",
			email: "",
			company: "",
			topic: "sales",
			message: "",
		},
	});

	function onSubmit(values: ContactValues) {
		setSubmitting(true);
		// Until the contact endpoint lands, route through the user's mail client.
		// The form keeps validation + structure so swapping to a real POST is one change.
		const subject = `[Leadly] ${TOPICS.find((t) => t.value === values.topic)?.label ?? "Contact"} — ${values.name}`;
		const body = [
			`Name: ${values.name}`,
			`Email: ${values.email}`,
			values.company ? `Company: ${values.company}` : null,
			"",
			values.message,
		]
			.filter(Boolean)
			.join("\n");
		const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
		window.location.href = mailto;
		setSubmitted(true);
		setSubmitting(false);
	}

	if (submitted) {
		return (
			<div className="rounded-2xl border border-border bg-card p-8 md:p-10">
				<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-blue">
					<span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
					Message ready
				</div>
				<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
					Your mail client just opened.
				</h2>
				<p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
					Hit send there and we'll come back to you. Didn't open? Email us
					directly at{" "}
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						className="text-accent-blue underline-offset-4 hover:underline"
					>
						{CONTACT_EMAIL}
					</a>
					.
				</p>
				<button
					type="button"
					onClick={() => {
						form.reset();
						setSubmitted(false);
					}}
					className="mt-6 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					← Send another
				</button>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-border bg-card p-6 md:p-8">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
					</div>

					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<FormField
							control={form.control}
							name="company"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										Company{" "}
										<span className="font-normal text-muted-foreground">
											(optional)
										</span>
									</FormLabel>
									<FormControl>
										<Input
											autoComplete="organization"
											placeholder="Northbeam"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="topic"
							render={({ field }) => (
								<FormItem>
									<FormLabel>What's this about?</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value}
									>
										<FormControl>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Pick one" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{TOPICS.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name="message"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Message</FormLabel>
								<FormControl>
									<Textarea
										rows={6}
										placeholder="A few sentences about what you're trying to do — the more context, the faster we can help."
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-xs text-muted-foreground">
							We'll only use this to reply. No newsletters, no funnels.
						</p>
						<Button
							type="submit"
							size="lg"
							disabled={submitting}
							className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
						>
							{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Send message
							<ArrowRight className="ml-2 h-4 w-4" />
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}

function ChannelsSidebar() {
	return (
		<aside className="space-y-6">
			<div>
				<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
					Or reach us here
				</p>
				<ul className="space-y-2">
					{CHANNELS.map((c) => (
						<li key={c.label}>
							<a
								href={c.href}
								target={c.href.startsWith("http") ? "_blank" : undefined}
								rel={c.href.startsWith("http") ? "noreferrer" : undefined}
								className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-accent-blue/30"
							>
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-blue/20 bg-accent-blue/5">
									<c.icon className="h-4 w-4 text-accent-blue" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium tracking-tight">
										{c.label}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										{c.handle}
									</div>
								</div>
								<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
							</a>
						</li>
					))}
				</ul>
			</div>

			<div className="rounded-xl border border-border bg-secondary/20 p-4">
				<div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
					Response time
				</div>
				<p className="text-sm leading-relaxed text-muted-foreground">
					Usually <span className="font-medium text-foreground">1–2 business days</span>.
					For urgent product issues during preview, the fastest path is the
					community Discord.
				</p>
			</div>
		</aside>
	);
}
