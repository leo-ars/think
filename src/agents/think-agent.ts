import { type Session, Think, Workspace } from "@cloudflare/think";
import { callable, type Schedule } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { buildSoulPrompt } from "../prompts";
import { buildTools } from "../tools";

/**
 * Top-level chat agent. Wires the model, session/memory, and tools, and keeps
 * the MCP, OAuth, and scheduling lifecycle. Tools live in `src/tools/*`.
 */
export class ThinkAgent extends Think<Env> {
  // Spill large files to R2; small files stay inline in SQLite.
  override workspace = new Workspace({
    sql: this.ctx.storage.sql,
    r2: this.env.R2,
    name: () => this.name
  });

  // Sandboxed code execution + browser tools use the WorkerLoader binding.
  override extensionLoader = this.env.LOADER;

  override maxSteps = 10;

  getModel() {
    return createWorkersAI({ binding: this.env.AI })(
      "@cf/moonshotai/kimi-k2.6",
      {
        sessionAffinity: this.sessionAffinity
      }
    );
  }

  override configureSession(session: Session) {
    return session
      .withContext("soul", {
        provider: { get: async () => buildSoulPrompt() }
      })
      .withContext("memory", {
        description: "Important facts learned during the conversation.",
        maxTokens: 2000
      })
      .withCachedPrompt();
  }

  override getTools() {
    return buildTools({ agent: this, env: this.env });
  }

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}
