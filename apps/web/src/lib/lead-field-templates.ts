import type { LeadField } from "@leadly/schemas";

// Starter lead fields by industry, offered in agent settings.
export const LEAD_FIELD_TEMPLATES: Array<{
	id: string;
	label: string;
	fields: LeadField[];
}> = [
	{
		id: "software",
		label: "Software / SaaS",
		fields: [
			{
				key: "project",
				label: "Project",
				hint: "What they want to build or the problem to solve",
				type: "text",
				mode: "ask",
			},
			{
				key: "timeline",
				label: "Timeline",
				type: "choice",
				options: ["ASAP", "This month", "This quarter", "Just exploring"],
				mode: "ask",
			},
			{ key: "team_size", label: "Team size", type: "number", mode: "listen" },
			{ key: "budget", label: "Budget", type: "text", mode: "listen" },
			{
				key: "current_tool",
				label: "Current tool",
				hint: "What they use today",
				type: "text",
				mode: "listen",
			},
		],
	},
	{
		id: "agency",
		label: "Agency / services",
		fields: [
			{ key: "project_type", label: "Project type", type: "text", mode: "ask" },
			{ key: "budget", label: "Budget", type: "text", mode: "ask" },
			{ key: "deadline", label: "Deadline", type: "text", mode: "ask" },
			{ key: "company", label: "Company", type: "text", mode: "listen" },
		],
	},
	{
		id: "real_estate",
		label: "Real estate",
		fields: [
			{
				key: "buy_or_rent",
				label: "Buying or renting",
				type: "choice",
				options: ["Buying", "Renting"],
				mode: "ask",
			},
			{ key: "location", label: "Location", type: "text", mode: "ask" },
			{
				key: "property_type",
				label: "Property type",
				type: "choice",
				options: ["Apartment", "House", "Commercial", "Land"],
				mode: "ask",
			},
			{ key: "budget", label: "Budget", type: "text", mode: "ask" },
			{ key: "move_in", label: "Move-in date", type: "text", mode: "listen" },
		],
	},
	{
		id: "ecommerce",
		label: "E-commerce",
		fields: [
			{
				key: "product_interest",
				label: "Product interest",
				type: "text",
				mode: "ask",
			},
			{
				key: "order_size",
				label: "Order size",
				type: "number",
				mode: "listen",
			},
			{
				key: "shipping_location",
				label: "Shipping location",
				type: "text",
				mode: "listen",
			},
		],
	},
	{
		id: "clinic",
		label: "Clinic / healthcare",
		fields: [
			{ key: "treatment", label: "Treatment", type: "text", mode: "ask" },
			{
				key: "preferred_date",
				label: "Preferred date",
				type: "text",
				mode: "ask",
			},
			{
				key: "insured",
				label: "Has insurance",
				type: "yes_no",
				mode: "listen",
			},
		],
	},
];
