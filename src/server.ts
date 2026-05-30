import { routeAgentRequest } from "agents";

export { ResearchAgent } from "./agents/research-agent";
// Durable Object classes must be exported from the Worker's main module
// (configured as `main` in wrangler.jsonc) so their bindings resolve.
export { ThinkAgent } from "./agents/think-agent";

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
