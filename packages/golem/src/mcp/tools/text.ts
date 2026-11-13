// Import Third-party Dependencies
import {
  SCRIPT_KIND,
  SHADER_KIND,
  TEXT_KIND
} from "@jolly-pixel/asset.script/client";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kTextKinds = [SCRIPT_KIND, SHADER_KIND, TEXT_KIND] as const;

export function registerTextTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "text_read",
    {
      description: "Read a script, shader or text asset, whole or a range " +
        "of lines. Answers the text, the lines it covers and the line count.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        from: z.int()
          .min(1)
          .optional()
          .describe("The first line, from 1. Default 1."),
        to: z.int()
          .min(1)
          .optional()
          .describe("The last line, included. Default: the last line.")
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId, from = 1, to }) => {
      const asset = await session.open(assetId, kTextKinds);

      return jsonResult({
        assetId,
        kind: asset.kind,
        ...asset.lines({
          from,
          to
        })
      });
    }
  );

  server.registerTool(
    "text_replace",
    {
      description: "Replace a piece of a script, shader or text asset, and " +
        "wait until the studio accepts it. The search text must appear " +
        "exactly once unless all is true: copy enough surrounding lines to " +
        "make it unique. Fails when it is not found.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        search: z.string()
          .min(1)
          .describe("The exact text to replace, whitespace included."),
        replace: z.string()
          .describe("The new text; empty to delete."),
        all: z.boolean()
          .optional()
          .describe("Replace every occurrence. Default false.")
      })
    },
    async({ assetId, search, replace, all }) => {
      const asset = await session.open(assetId, kTextKinds);
      const replaced = await asset.replace(search, replace, { all });
      await asset.settled();

      return jsonResult({
        assetId,
        replaced
      });
    }
  );

  server.registerTool(
    "text_write",
    {
      description: "Replace the whole text of a script, shader or text " +
        "asset, and wait until the studio accepts it. Only the changed part " +
        "is sent, but prefer text_replace for small changes.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        text: z.string()
      })
    },
    async({ assetId, text }) => {
      const asset = await session.open(assetId, kTextKinds);
      await asset.write(text);
      await asset.settled();

      return jsonResult({
        assetId,
        lineCount: asset.lineCount
      });
    }
  );
}
