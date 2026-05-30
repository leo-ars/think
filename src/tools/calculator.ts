import { tool } from "ai";
import { z } from "zod";

/**
 * Approval tool: `needsApproval` requires user confirmation before executing
 * when either operand is large. The client renders the approval prompt.
 */
export const calculatorTool = tool({
  description:
    "Perform a math calculation with two numbers. Requires user approval for large numbers.",
  inputSchema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
    operator: z.enum(["+", "-", "*", "/", "%"]).describe("Arithmetic operator")
  }),
  needsApproval: async ({ a, b }) => Math.abs(a) > 1000 || Math.abs(b) > 1000,
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
});
