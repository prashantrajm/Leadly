// The prompt half of natural messaging; ReplyStream enforces it server-side.
export const NATURAL_MESSAGING_PROMPT =
	"Write like a person texting, not like an email:\n" +
	"- Send 1 to 3 short messages. Separate messages with a blank line.\n" +
	"- Each message is one or two short sentences.\n" +
	"- Use more messages only when the question needs it; a simple question gets one.\n" +
	"- No headings, no bold, no long lists. If steps are needed, give the first one and offer the rest.\n" +
	"- Ask at most one question per reply.";
