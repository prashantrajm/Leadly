import * as ai from "ai";
import { Client } from "langsmith";
import { wrapAISDK } from "langsmith/experimental/vercel";

type LangSmithBindings = {
	LANGCHAIN_TRACING?: string;
	LANGCHAIN_API_KEY?: string;
	LANGCHAIN_PROJECT?: string;
	LANGSMITH_TRACING?: string;
	LANGSMITH_API_KEY?: string;
	LANGSMITH_PROJECT?: string;
};

export const { generateObject, streamText } = wrapAISDK(ai);

export function configureLangSmith(env: LangSmithBindings): void {
	if (typeof process === "undefined") return;

	const tracing = env.LANGSMITH_TRACING ?? env.LANGCHAIN_TRACING;
	const apiKey = env.LANGSMITH_API_KEY ?? env.LANGCHAIN_API_KEY;
	const project = env.LANGSMITH_PROJECT ?? env.LANGCHAIN_PROJECT;

	setEnv("LANGSMITH_TRACING", tracing);
	setEnv("LANGSMITH_API_KEY", apiKey);
	setEnv("LANGSMITH_PROJECT", project);
	setEnv("LANGCHAIN_TRACING", tracing);
	setEnv("LANGCHAIN_API_KEY", apiKey);
	setEnv("LANGCHAIN_PROJECT", project);
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
		(process.env.LANGSMITH_TRACING === "true" ||
			process.env.LANGCHAIN_TRACING === "true")
	);
}
