export function assertNever(x: never, message = "Unreachable case"): never {
	throw new Error(`${message}: ${JSON.stringify(x)}`);
}
