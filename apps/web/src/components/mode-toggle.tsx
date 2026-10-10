import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Standard shadcn mode toggle. The sun + moon icons cross-fade based on the
// resolved theme so the trigger always shows the current state. The dropdown
// exposes the explicit Light / Dark / System options.
export function ModeToggle({
	size = "icon-sm",
}: {
	size?: "icon-sm" | "icon" | "sm";
}) {
	const { setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size={size}
					className="text-muted-foreground hover:text-foreground"
					aria-label="Toggle theme"
				>
					<SunIcon className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
					<MoonIcon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					<SunIcon className="mr-2 size-4" />
					Light
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					<MoonIcon className="mr-2 size-4" />
					Dark
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					<svg
						className="mr-2 size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden
					>
						<title>System</title>
						<rect width="20" height="14" x="2" y="3" rx="2" />
						<line x1="8" x2="16" y1="21" y2="21" />
						<line x1="12" x2="12" y1="17" y2="21" />
					</svg>
					System
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
