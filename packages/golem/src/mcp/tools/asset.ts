// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import {
  MAX_BATCH_COMMANDS,
  type GolemAsset,
  type GolemIntent,
  type GolemIntents
} from "@jolly-pixel/golem.kit";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import { UnknownIntentError } from "../errors/UnknownIntentError.ts";
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
        "its kind, the resource holding its command schema and, when its " +
        "kind has them, a guide and the intents asset_intent runs with " +
        "their input schema.",
      inputSchema: kAssetId,
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const golem = await session.golem();
      const asset = await golem.open(assetId);
      const { intents, guide } = golem.kinds.contribution(asset.kind);
      const names = Object.keys(intents);

      return jsonResult({
        assetId,
        kind: asset.kind,
        schema: schemaUri(asset.kind),
        ...(guide === null ? {} : { guide: await fs.readFile(guide, "utf-8") }),
        ...(names.length === 0 ? {} : {
          intents: names.map((name) => {
            return {
              name,
              description: intents[name].description,
              input: z.toJSONSchema(intents[name].input, { io: "input" })
            };
          })
        })
      });
    }
  );

  server.registerTool(
    "asset_intent",
    {
      description: "Run one of the intents asset_open lists for an asset, " +
        "opening it if needed, and wait until the studio accepts the " +
        "commands it sent. Answers what the intent returns.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        intent: z.string()
          .describe("The intent name from asset_open."),
        input: z.record(z.string(), z.unknown())
          .default({})
          .describe("Follows the intent's input schema.")
      })
    },
    async({ assetId, intent, input }) => {
      const golem = await session.golem();
      const asset = await golem.open(assetId);
      const { intents } = golem.kinds.contribution(asset.kind);
      const result = await findIntent(asset.kind, intents, intent).run(asset, input);
      await asset.settled();

      return jsonResult({
        assetId,
        intent,
        result
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
      const golem = await session.golem();
      const asset = await golem.open(assetId);

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
      const golem = await session.golem();
      const asset = await golem.open(assetId);
      await asset.apply(commands);
      await asset.settled();

      return jsonResult({
        assetId,
        applied: commands.length
      });
    }
  );
}

function findIntent(
  kind: string,
  intents: GolemIntents<GolemAsset>,
  name: string
): GolemIntent<GolemAsset> {
  if (!Object.hasOwn(intents, name)) {
    throw new UnknownIntentError(kind, name, Object.keys(intents));
  }

  return intents[name];
}
