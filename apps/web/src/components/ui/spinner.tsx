import { type IconProps, SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: IconProps) {
	return (
		<SpinnerIcon
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
