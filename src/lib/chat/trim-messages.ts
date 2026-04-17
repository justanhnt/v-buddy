import type { UIMessage } from "ai";

/**
 * Strip heavy data (path arrays, full search results) from older tool outputs
 * so the LLM context stays small. The UI retains the full data.
 */
export function trimMessagesForModel(messages: UIMessage[]): UIMessage[] {
  // Keep at most the last 20 messages (10 user + 10 assistant turns)
  const recent = messages.slice(-20);

  // For all but the last 4 messages, strip large tool output fields
  return recent.map((msg, idx) => {
    const isRecent = idx >= recent.length - 4;
    if (isRecent || msg.role !== "assistant") return msg;

    return {
      ...msg,
      parts: msg.parts.map((part) => {
        if (
          typeof part.type === "string" &&
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part &&
          part.output &&
          typeof part.output === "object"
        ) {
          const output = part.output as Record<string, unknown>;
          const cleaned = { ...output };

          // Remove path arrays (biggest offender)
          if (Array.isArray(cleaned.path)) {
            cleaned.path = `[${(cleaned.path as unknown[]).length} points]`;
          }
          // Remove paths from nested routes/legs
          if (Array.isArray(cleaned.routes)) {
            cleaned.routes = (cleaned.routes as Record<string, unknown>[]).map(
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ({ path: _p, ...rest }) => rest,
            );
          }
          if (Array.isArray(cleaned.legs)) {
            cleaned.legs = (cleaned.legs as Record<string, unknown>[]).map(
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ({ path: _p, ...rest }) => rest,
            );
          }
          // Trim places lists
          if (Array.isArray(cleaned.places) && (cleaned.places as unknown[]).length > 3) {
            cleaned.places = (cleaned.places as Record<string, unknown>[]).slice(0, 3);
          }
          // Trim web search results
          if (Array.isArray(cleaned.results) && (cleaned.results as unknown[]).length > 2) {
            cleaned.results = (cleaned.results as Record<string, unknown>[]).slice(0, 2);
          }

          return { ...part, output: cleaned };
        }
        return part;
      }),
    };
  });
}
