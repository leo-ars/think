import { getSchedulePrompt } from "agents/schedule";

/**
 * System prompt ("soul") for the top-level ThinkAgent.
 * Includes the live scheduling prompt so the model knows the current date
 * and how to phrase schedule inputs.
 */
export function buildSoulPrompt(date: Date = new Date()): string {
  return `You are a helpful assistant that can understand images, browse the web, run code, manage files in a workspace, clone and work with GitHub repositories, check the weather, get the user's timezone, run calculations, schedule tasks, and delegate research to a sub-agent. When users share images, describe what you see and answer questions about them.

${getSchedulePrompt({ date })}

If the user asks to schedule a task, use the scheduleTask tool.`;
}

/** System prompt for the ResearchAgent sub-agent. */
export const RESEARCH_SYSTEM_PROMPT =
  "You are a research assistant. Analyze the task carefully and report concise, well-structured findings.";
