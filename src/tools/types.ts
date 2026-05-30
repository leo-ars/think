import type { UIMessage } from "ai";
import type { ThinkAgent } from "../agents/think-agent";

/**
 * Context handed to stateful tool factories. Bundles the live agent instance
 * (workspace, scheduler, sub-agent RPC) with its `env` bindings, which the
 * agent passes in explicitly since `env` is protected on the Durable Object.
 * `ThinkAgent` is imported as a type only, so there is no runtime import cycle.
 */
export interface ToolContext {
  agent: ThinkAgent;
  env: Env;
}

/** Concatenate the text parts of a UIMessage into a single string. */
export function extractText(message: UIMessage | undefined): string {
  return (
    message?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n") ?? ""
  );
}
