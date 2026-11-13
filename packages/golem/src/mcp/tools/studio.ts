// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";

export function registerStudioTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "studio_status",
    {
      description: "The studio URL, your role, the people and agents " +
        "connected, and the assets you have open.",
      annotations: {
        readOnlyHint: true
      }
    },
    async() => jsonResult((await session.golem()).status())
  );
}
