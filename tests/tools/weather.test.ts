import { describe, expect, it } from "vitest";
import { weatherTool } from "../../src/tools/weather";

type WeatherResult = {
  city: string;
  temperature: number;
  condition: string;
  unit: string;
};

describe("weatherTool", () => {
  it("returns a well-formed weather report for a city", async () => {
    if (!weatherTool.execute) {
      throw new Error("weatherTool.execute is not defined");
    }
    const result = (await weatherTool.execute(
      { city: "London" },
      { toolCallId: "test", messages: [] }
    )) as WeatherResult;

    expect(result).toMatchObject({ city: "London", unit: "celsius" });
    expect(typeof result.temperature).toBe("number");
    expect(["sunny", "cloudy", "rainy", "snowy"]).toContain(result.condition);
  });
});
