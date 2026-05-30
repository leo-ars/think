import { tool } from "ai";
import { z } from "zod";

/**
 * Server-side tool: runs automatically on the server.
 * Replace the stubbed data with a real weather API in production.
 */
export const weatherTool = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name")
  }),
  execute: async ({ city }) => {
    const conditions = ["sunny", "cloudy", "rainy", "snowy"];
    const temp = Math.floor(Math.random() * 30) + 5;
    return {
      city,
      temperature: temp,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      unit: "celsius"
    };
  }
});
