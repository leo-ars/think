import { describe, expect, it } from "vitest";
import { calculatorTool } from "../../src/tools/calculator";

type CalcInput = {
  a: number;
  b: number;
  operator: "+" | "-" | "*" | "/" | "%";
};

type CalcResult = { expression: string; result: number } | { error: string };

const options = { toolCallId: "test", messages: [] };

async function run(input: CalcInput): Promise<CalcResult> {
  if (!calculatorTool.execute) {
    throw new Error("calculatorTool.execute is not defined");
  }
  // The AI SDK execute signature accepts (input, options); options is unused here.
  return (await calculatorTool.execute(input, options)) as CalcResult;
}

describe("calculatorTool", () => {
  it("adds two numbers", async () => {
    await expect(run({ a: 2, b: 3, operator: "+" })).resolves.toMatchObject({
      expression: "2 + 3",
      result: 5
    });
  });

  it("subtracts, multiplies, divides, and mods", async () => {
    await expect(run({ a: 10, b: 4, operator: "-" })).resolves.toMatchObject({
      result: 6
    });
    await expect(run({ a: 6, b: 7, operator: "*" })).resolves.toMatchObject({
      result: 42
    });
    await expect(run({ a: 8, b: 2, operator: "/" })).resolves.toMatchObject({
      result: 4
    });
    await expect(run({ a: 9, b: 4, operator: "%" })).resolves.toMatchObject({
      result: 1
    });
  });

  it("returns an error on division by zero", async () => {
    await expect(run({ a: 1, b: 0, operator: "/" })).resolves.toMatchObject({
      error: "Division by zero"
    });
  });

  it("requires approval only for large operands", async () => {
    const { needsApproval } = calculatorTool;
    if (typeof needsApproval !== "function") {
      throw new Error("calculatorTool.needsApproval is not a function");
    }
    await expect(
      needsApproval({ a: 5, b: 5, operator: "+" }, options)
    ).resolves.toBe(false);
    await expect(
      needsApproval({ a: 5000, b: 1, operator: "+" }, options)
    ).resolves.toBe(true);
  });
});
