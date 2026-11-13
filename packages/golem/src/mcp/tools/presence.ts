// Import Third-party Dependencies
import { PEER_ACTIVITY_LABEL_MAX_LENGTH } from "@jolly-pixel/network";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

export function registerPresenceTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "presence_activity",
    {
      description: "Tell the people in an asset what you are doing, such " +
        "as \"Placing 12 trees\". Clear it with presence_clear.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        label: z.string()
          .describe(`At most ${PEER_ACTIVITY_LABEL_MAX_LENGTH} characters.`),
        progress: z.number()
          .optional()
          .describe("From 0 to 1.")
      })
    },
    async({ assetId, label, progress }) => {
      const golem = await session.golem();
      golem.activity(await golem.open(assetId), {
        label,
        progress
      });

      return jsonResult({
        assetId,
        label,
        progress
      });
    }
  );

  server.registerTool(
    "presence_clear",
    {
      description: "Clear the activity published with presence_activity."
    },
    async() => {
      const golem = await session.golem();
      golem.clearActivity();

      return jsonResult({ cleared: true });
    }
  );
}
