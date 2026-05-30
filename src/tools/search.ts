import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types";

const LINKUP_SEARCH_URL = "https://api.linkup.so/v1/search";

/**
 * Web search via Linkup (https://docs.linkup.so). Plain REST API, so it works
 * in Workers with `fetch` — no Node SDK required. Set `LINKUP_API_KEY` as a
 * secret (`.dev.vars` locally, `wrangler secret put` in production).
 */
export function createSearchTool(ctx: ToolContext) {
  return tool({
    description:
      "Search the web for up-to-date information using Linkup. Returns relevant results with titles, URLs, and content snippets.",
    inputSchema: z.object({
      query: z.string().describe("Natural language search query"),
      depth: z
        .enum(["standard", "deep"])
        .default("standard")
        .describe(
          "standard: fast agentic search for most queries; deep: multi-iteration search for comprehensive coverage"
        )
    }),
    execute: async ({ query, depth }) => {
      const apiKey = ctx.env.LINKUP_API_KEY;
      if (!apiKey) {
        return { error: "LINKUP_API_KEY is not configured." };
      }
      const res = await fetch(LINKUP_SEARCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: query,
          depth,
          outputType: "searchResults",
          includeImages: false
        })
      });
      if (!res.ok) {
        return {
          error: `Linkup search failed: ${res.status} ${await res.text()}`
        };
      }
      return await res.json();
    }
  });
}
