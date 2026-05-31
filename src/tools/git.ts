import { WorkspaceFileSystem } from "@cloudflare/shell";
import { createGit } from "@cloudflare/shell/git";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types";

/**
 * Top-level GitHub tools backed by `@cloudflare/shell/git` (isomorphic-git over
 * `fetch`, writing into the agent's `Workspace`). These run host-side, so they
 * work even though the `execute` sandbox is network-isolated.
 *
 * Write operations (`gitCommitPush`) auto-inject `env.GITHUB_TOKEN`; the model
 * never sees the secret. The same `git.*` namespace is also exposed inside the
 * `execute` sandbox via `gitTools(...)` in `src/tools/index.ts`.
 */
export function createGitTools(ctx: ToolContext): ToolSet {
  const git = createGit(new WorkspaceFileSystem(ctx.agent.workspace));

  return {
    gitClone: tool({
      description:
        "Clone a GitHub (or any HTTP) git repository into the workspace filesystem. Use a shallow depth for large repos.",
      inputSchema: z.object({
        url: z
          .string()
          .describe("Repository URL, e.g. https://github.com/org/repo"),
        dir: z
          .string()
          .optional()
          .describe(
            "Target directory in the workspace (defaults to repo name)"
          ),
        depth: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Shallow clone depth (omit for full history)"),
        branch: z.string().optional().describe("Branch or ref to check out")
      }),
      execute: async ({ url, dir, depth, branch }) => {
        try {
          const result = await git.clone({
            url,
            dir,
            depth,
            branch,
            token: ctx.env.GITHUB_TOKEN
          });
          return { cloned: result.cloned, dir: result.dir };
        } catch (error) {
          return { error: `git clone failed: ${error}` };
        }
      }
    }),

    gitStatusLog: tool({
      description:
        "Inspect a cloned repository: returns the working-tree status and the most recent commits.",
      inputSchema: z.object({
        dir: z
          .string()
          .optional()
          .describe("Repository directory in the workspace"),
        depth: z
          .number()
          .int()
          .positive()
          .default(10)
          .describe("Number of recent commits to return")
      }),
      execute: async ({ dir, depth }) => {
        try {
          const [status, log] = await Promise.all([
            git.status({ dir }),
            git.log({ dir, depth })
          ]);
          return { status, log };
        } catch (error) {
          return { error: `git status/log failed: ${error}` };
        }
      }
    }),

    gitCommitPush: tool({
      description:
        "Stage all changes, commit, and push a cloned repository back to its remote. Requires a configured GITHUB_TOKEN.",
      inputSchema: z.object({
        message: z.string().describe("Commit message"),
        dir: z
          .string()
          .optional()
          .describe("Repository directory in the workspace"),
        remote: z
          .string()
          .optional()
          .describe("Remote name (defaults to origin)"),
        branch: z.string().optional().describe("Branch/ref to push"),
        authorName: z
          .string()
          .default("Think Agent")
          .describe("Commit author name"),
        authorEmail: z
          .string()
          .default("agent@think.local")
          .describe("Commit author email")
      }),
      execute: async ({
        message,
        dir,
        remote,
        branch,
        authorName,
        authorEmail
      }) => {
        if (!ctx.env.GITHUB_TOKEN) {
          return { error: "GITHUB_TOKEN is not configured; cannot push." };
        }
        try {
          await git.add({ filepath: ".", dir });
          const commit = await git.commit({
            message,
            dir,
            author: { name: authorName, email: authorEmail }
          });
          const push = await git.push({
            dir,
            remote,
            ref: branch,
            token: ctx.env.GITHUB_TOKEN
          });
          return { oid: commit.oid, message: commit.message, pushed: push.ok };
        } catch (error) {
          return { error: `git commit/push failed: ${error}` };
        }
      }
    })
  };
}
