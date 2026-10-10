import type { IconComponent } from "@/components/icons";

export interface NavItem {
	title: string;
	href?: string;
	items?: {
		title: string;
		href: string;
		description: string;
	}[];
}

export interface FooterSection {
	title: string;
	links: {
		title: string;
		href: string;
	}[];
}

export interface SocialLink {
	icon: IconComponent;
	href: string;
	label: string;
}

export interface PaymentMethod {
	name: string;
	icon: string;
}

export interface HowItWorksStep {
	icon: IconComponent;
	title: string;
	description: string;
}

export interface Category {
	name: string;
	icon: IconComponent;
	href: string;
	color: string;
	count: string;
}

export interface Stat {
	icon: IconComponent;
	label: string;
	value: string;
}
