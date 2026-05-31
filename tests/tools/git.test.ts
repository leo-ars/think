import type { ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import { createGitTools } from "../../src/tools/git";
import type { ToolContext } from "../../src/tools/types";

const options = { toolCallId: "test", messages: [] };

// Minimal workspace stub: createGit wraps it in WorkspaceFileSystem, but the
// guard paths we test here never reach the filesystem.
function makeCtx(token: string | undefined): ToolContext {
  return {
    agent: { workspace: {} } as unknown as ToolContext["agent"],
    env: { GITHUB_TOKEN: token } as unknown as ToolContext["env"]
  };
}

async function runTool(tools: ToolSet, name: string, input: unknown) {
  const t = tools[name];
  if (!t?.execute) {
    throw new Error(`${name}.execute is not defined`);
  }
  return t.execute(input, options);
}

describe("createGitTools", () => {
  it("registers the expected top-level tools", () => {
    const tools = createGitTools(makeCtx("ghp_test"));
    expect(Object.keys(tools).sort()).toEqual([
      "gitClone",
      "gitCommitPush",
      "gitStatusLog"
    ]);
  });

  it("refuses to push when GITHUB_TOKEN is missing", async () => {
    const tools = createGitTools(makeCtx(undefined));
    await expect(
      runTool(tools, "gitCommitPush", {
        message: "test",
        authorName: "a",
        authorEmail: "b"
      })
    ).resolves.toMatchObject({
      error: "GITHUB_TOKEN is not configured; cannot push."
    });
  });
});
