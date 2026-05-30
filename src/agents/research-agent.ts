import { createWorkersAI } from "workers-ai-provider";
import { Think } from "@cloudflare/think";
import { RESEARCH_SYSTEM_PROMPT } from "../prompts";

/**
 * Sub-agent used by the `delegateResearch` tool. Runs focused research
 * turns via RPC (`chat()`) and reports findings back to the parent.
 */
export class ResearchAgent extends Think<Env> {
  getModel() {
    return createWorkersAI({ binding: this.env.AI })(
      "@cf/moonshotai/kimi-k2.6",
      {
        sessionAffinity: this.sessionAffinity
      }
    );
  }

  override getSystemPrompt() {
    return RESEARCH_SYSTEM_PROMPT;
  }
}
