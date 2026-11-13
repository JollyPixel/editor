// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import { MAX_BATCH_COMMANDS } from "../../assets/GolemAsset.ts";
import type { GolemSession } from "../GolemSession.ts";
import { schemaUri } from "../resources.ts";
import { jsonResult } from "./results.ts";

// CONSTANTS
export const ASSET_ID_FIELD = z.string()
  .describe("The asset id from catalog_list.");

const kAssetId = z.object({
  assetId: ASSET_ID_FIELD
});

export function registerAssetTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "asset_open",
    {
      description: "Join an asset's room so people see you in it. Returns " +
        "its kind and the resource holding its command schema.",
      inputSchema: kAssetId,
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const asset = await session.open(assetId);

      return jsonResult({
        assetId,
        kind: asset.kind,
        schema: schemaUri(asset.kind)
      });
    }
  );

  server.registerTool(
    "asset_close",
    {
      description: "Leave an asset's room.",
      inputSchema: kAssetId,
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const golem = await session.golem();
      golem.close(assetId);

      return jsonResult({ assetId });
    }
  );

  server.registerTool(
    "asset_read",
    {
      description: "The asset's document as JSON, opening the asset if " +
        "needed. Large documents are truncated: read them from a script.",
      inputSchema: kAssetId,
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const asset = await session.open(assetId);

      return jsonResult(asset.read());
    }
  );

  server.registerTool(
    "asset_apply",
    {
      description: "Apply a batch of commands to an asset, opening it if " +
        "needed, and wait until the studio accepts them all. Each command " +
        "follows the kind's schema resource (jollypixel://schemas/<kind>). " +
        `At most ${MAX_BATCH_COMMANDS} commands; write a script for more.`,
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        commands: z.array(z.record(z.string(), z.unknown()))
          .describe("Commands, each with an \"action\".")
      })
    },
    async({ assetId, commands }) => {
      const asset = await session.open(assetId);
      await asset.apply(commands);
      await asset.settled();

      return jsonResult({
        assetId,
        applied: commands.length
      });
    }
  );
}
