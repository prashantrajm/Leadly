import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin wrapper around next-themes with the shadcn-recommended defaults:
//   attribute="class"          — toggles `.dark` on <html> so our @custom-variant
//                                 dark (&:is(.dark *)) selectors flip
//   defaultTheme="system"      — respect the OS preference on first visit
//   enableSystem               — let users pick "system" explicitly
//   disableTransitionOnChange  — kill the half-second flash when toggling
export function ThemeProvider({
	children,
	...props
}: ComponentProps<typeof NextThemesProvider>) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			{...props}
		>
			{children}
		</NextThemesProvider>
	);
}
