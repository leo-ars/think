import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import {
  Think,
  Session,
  Workspace,
  type StreamCallback
} from "@cloudflare/think";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
import { createWorkspaceTools } from "@cloudflare/think/tools/workspace";
import { createBrowserTools } from "@cloudflare/think/tools/browser";
import { createWorkspaceStateBackend } from "@cloudflare/shell";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

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
        provider: {
          get: async () =>
            `You are a helpful assistant that can understand images, browse the web, run code, manage files in a workspace, check the weather, get the user's timezone, run calculations, schedule tasks, and delegate research to a sub-agent. When users share images, describe what you see and answer questions about them.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the scheduleTask tool.`
        }
      })
      .withContext("memory", {
        description: "Important facts learned during the conversation.",
        maxTokens: 2000
      })
      .withCachedPrompt();
  }

  override getTools(): ToolSet {
    return {
      // Sandboxed JS execution with full workspace filesystem access.
      execute: createExecuteTool({
        tools: createWorkspaceTools(this.workspace),
        state: createWorkspaceStateBackend(this.workspace),
        loader: this.env.LOADER
      }),

      // Chrome DevTools Protocol: browser_search + browser_execute.
      ...createBrowserTools({
        browser: this.env.BROWSER,
        loader: this.env.LOADER
      }),

      // Server-side tool: runs automatically on the server
      getWeather: tool({
        description: "Get the current weather for a city",
        inputSchema: z.object({
          city: z.string().describe("City name")
        }),
        execute: async ({ city }) => {
          // Replace with a real weather API in production
          const conditions = ["sunny", "cloudy", "rainy", "snowy"];
          const temp = Math.floor(Math.random() * 30) + 5;
          return {
            city,
            temperature: temp,
            condition:
              conditions[Math.floor(Math.random() * conditions.length)],
            unit: "celsius"
          };
        }
      }),

      // Client-side tool: no execute function — the browser handles it
      getUserTimezone: tool({
        description:
          "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
        inputSchema: z.object({})
      }),

      // Approval tool: requires user confirmation before executing
      calculate: tool({
        description:
          "Perform a math calculation with two numbers. Requires user approval for large numbers.",
        inputSchema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
          operator: z
            .enum(["+", "-", "*", "/", "%"])
            .describe("Arithmetic operator")
        }),
        needsApproval: async ({ a, b }) =>
          Math.abs(a) > 1000 || Math.abs(b) > 1000,
        execute: async ({ a, b, operator }) => {
          const ops: Record<string, (x: number, y: number) => number> = {
            "+": (x, y) => x + y,
            "-": (x, y) => x - y,
            "*": (x, y) => x * y,
            "/": (x, y) => x / y,
            "%": (x, y) => x % y
          };
          if (operator === "/" && b === 0) {
            return { error: "Division by zero" };
          }
          return {
            expression: `${a} ${operator} ${b}`,
            result: ops[operator](a, b)
          };
        }
      }),

      scheduleTask: tool({
        description:
          "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
        inputSchema: scheduleSchema,
        execute: async ({ when, description }) => {
          if (when.type === "no-schedule") {
            return "Not a valid schedule input";
          }
          const input =
            when.type === "scheduled"
              ? when.date
              : when.type === "delayed"
                ? when.delayInSeconds
                : when.type === "cron"
                  ? when.cron
                  : null;
          if (!input) return "Invalid schedule type";
          try {
            this.schedule(input, "executeTask", description, {
              idempotent: true
            });
            return `Task scheduled: "${description}" (${when.type}: ${input})`;
          } catch (error) {
            return `Error scheduling task: ${error}`;
          }
        }
      }),

      getScheduledTasks: tool({
        description: "List all tasks that have been scheduled",
        inputSchema: z.object({}),
        execute: async () => {
          const tasks = this.getSchedules();
          return tasks.length > 0 ? tasks : "No scheduled tasks found.";
        }
      }),

      cancelScheduledTask: tool({
        description: "Cancel a scheduled task by its ID",
        inputSchema: z.object({
          taskId: z.string().describe("The ID of the task to cancel")
        }),
        execute: async ({ taskId }) => {
          try {
            this.cancelSchedule(taskId);
            return `Task ${taskId} cancelled.`;
          } catch (error) {
            return `Error cancelling task: ${error}`;
          }
        }
      }),

      // Sub-agent delegation: spin up a retained ResearchAgent child and
      // stream its turn back as a single tool result.
      delegateResearch: tool({
        description:
          "Delegate a focused research or analysis task to a specialized sub-agent and return its findings.",
        inputSchema: z.object({
          task: z.string().describe("The research task for the sub-agent")
        }),
        execute: async ({ task }) => {
          const child = await this.subAgent(ResearchAgent, "research-1");
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
          const last = findings.at(-1);
          const text =
            last?.parts
              ?.filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("\n") ?? "";
          return { task, findings: text, events: chunks.length };
        }
      })
    };
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
    return "You are a research assistant. Analyze the task carefully and report concise, well-structured findings.";
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
