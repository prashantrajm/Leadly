import * as ai from "ai";
import { Client } from "langsmith";
import { wrapAISDK } from "langsmith/experimental/vercel";

type LangSmithBindings = {
	LANGCHAIN_TRACING?: string;
	LANGCHAIN_API_KEY?: string;
};

export const { generateObject, streamText } = wrapAISDK(ai);

export function configureLangSmith(env: LangSmithBindings): void {
	if (typeof process === "undefined") return;

	setEnv("LANGCHAIN_TRACING", env.LANGCHAIN_TRACING);
	setEnv("LANGCHAIN_API_KEY", env.LANGCHAIN_API_KEY);
}

export async function flushLangSmithTraces(): Promise<void> {
	if (!isLangSmithTracingEnabled()) return;

	const client = new Client();
	await client.awaitPendingTraceBatches();
}

function setEnv(key: string, value: string | undefined): void {
	if (value && process.env[key] !== value) {
		process.env[key] = value;
	}
}

function isLangSmithTracingEnabled(): boolean {
	return (
		typeof process !== "undefined" &&
		process.env.LANGCHAIN_TRACING === "true"
	);
}
