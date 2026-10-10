import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's built-in utilities. Register the
// custom ones from styles.css so it doesn't mistake them for conflicts:
// unregistered, `bg-sheen` reads as a background colour and silently drops
// the `bg-primary` / `bg-accent-blue` before it.
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"bg-image": ["bg-sheen"],
			shadow: [
				{
					shadow: ["card", "card-hover", "raised", "solid", "overlay", "inset"],
				},
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
