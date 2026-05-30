import { tool } from "ai";
import { z } from "zod";
import type { StreamCallback } from "@cloudflare/think";
import { ResearchAgent } from "../agents/research-agent";
import { extractText, type ToolContext } from "./types";

/**
 * Sub-agent delegation: spin up a retained ResearchAgent child, run a turn
 * over RPC (`chat()`), and return its findings as a single tool result.
 */
export function createResearchTool(ctx: ToolContext) {
  return tool({
    description:
      "Delegate a focused research or analysis task to a specialized sub-agent and return its findings.",
    inputSchema: z.object({
      task: z.string().describe("The research task for the sub-agent")
    }),
    execute: async ({ task }) => {
      const child = await ctx.agent.subAgent(ResearchAgent, "research-1");
      const chunks: string[] = [];
      const callback: StreamCallback = {
        onEvent: (json) => {
          chunks.push(json);
        },
        onDone: () => {},
        onError: (error) => {
          console.error("Research sub-agent failed:", error);
        }
      };
      await child.chat(task, callback);
      const findings = await child.getMessages();
      return {
        task,
        findings: extractText(findings.at(-1)),
        events: chunks.length
      };
    }
  });
}
