import { createWorkspaceStateBackend } from "@cloudflare/shell";
import { createBrowserTools } from "@cloudflare/think/tools/browser";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
import { createWorkspaceTools } from "@cloudflare/think/tools/workspace";
import type { ToolSet } from "ai";
import { calculatorTool } from "./calculator";
import { createResearchTool } from "./research";
import { createSchedulingTools } from "./scheduling";
import { createSearchTool } from "./search";
import { userTimezoneTool } from "./timezone";
import type { ToolContext } from "./types";
import { weatherTool } from "./weather";

/**
 * Assemble the full tool set for the agent.
 *
 * How to add a new tool:
 *   1. Create `src/tools/<name>.ts` exporting either a `tool({...})` constant
 *      (stateless) or a `create<Name>Tool(ctx)` factory (needs the agent).
 *   2. Import it here and register it in the returned object below.
 */
export function buildTools(ctx: ToolContext): ToolSet {
  // Built once so it can be exposed both top-level and inside the sandbox.
  const searchWeb = createSearchTool(ctx);

  return {
    // Web search (top-level).
    searchWeb,

    // Sandboxed JS execution with full workspace filesystem access.
    // Web search is also exposed inside the sandbox as `codemode.searchWeb`.
    execute: createExecuteTool({
      tools: {
        ...createWorkspaceTools(ctx.agent.workspace),
        searchWeb
      },
      state: createWorkspaceStateBackend(ctx.agent.workspace),
      loader: ctx.env.LOADER
    }),

    // Chrome DevTools Protocol: browser_search + browser_execute.
    ...createBrowserTools({
      browser: ctx.env.BROWSER,
      loader: ctx.env.LOADER
    }),

    // Utility tools.
    getWeather: weatherTool,
    getUserTimezone: userTimezoneTool,
    calculate: calculatorTool,

    // Scheduling feature (create / list / cancel).
    ...createSchedulingTools(ctx),

    // Sub-agent delegation.
    delegateResearch: createResearchTool(ctx)
  };
}
