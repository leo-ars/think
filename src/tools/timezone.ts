import { tool } from "ai";
import { z } from "zod";

/**
 * Client-side tool: no `execute` function — the browser resolves it and
 * sends the result back. Wire the response in the client via `onToolCall`.
 */
export const userTimezoneTool = tool({
  description:
    "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
  inputSchema: z.object({})
});
