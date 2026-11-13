// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import {
  jsonResult,
  textResult
} from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

export function registerCatalogTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "catalog_list",
    {
      description: "List the project's assets with their id, kind and path.",
      inputSchema: z.object({
        folder: z.string().optional()
          .describe("Only list assets under this folder, such as \"scenes\"."),
        kind: z.string().optional()
          .describe("Only list assets of this kind, such as \"scene\".")
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ folder, kind }) => {
      const { catalog } = await session.golem();
      const prefix = folder === undefined ?
        "" :
        `${folder.replace(/\/+$/, "")}/`;
      const assets = Array.from(catalog.records())
        .filter((record) => record.path.startsWith(prefix))
        .filter((record) => kind === undefined || record.kind === kind)
        .map((record) => {
          return {
            assetId: record.id,
            kind: record.kind,
            path: record.path
          };
        })
        .sort((left, right) => left.path.localeCompare(right.path));

      return jsonResult(assets);
    }
  );

  server.registerTool(
    "catalog_create",
    {
      description: "Create an empty asset at a path. The extension picks " +
        "the kind, such as \"levels/forest.scene.json\" for a scene.",
      inputSchema: z.object({
        path: z.string(),
        kind: z.string().optional()
          .describe("The kind, when the extension is not enough.")
      })
    },
    async({ path, kind }) => {
      const { catalog } = await session.golem();
      const assetId = await catalog.create(path, null, { kind });

      return jsonResult({ assetId });
    }
  );

  server.registerTool(
    "catalog_rename",
    {
      description: "Move or rename an asset to a new path.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        to: z.string().describe("The new path.")
      })
    },
    async({ assetId, to }) => {
      const { catalog } = await session.golem();
      await catalog.rename(assetId, to);

      return jsonResult({
        assetId,
        path: to
      });
    }
  );

  server.registerTool(
    "catalog_preview",
    {
      description: "The preview image the studio shows for an asset, " +
        "when its kind has one.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const { catalog } = await session.golem();
      const preview = await catalog.preview(assetId);
      if (preview === null) {
        return textResult(`Asset "${assetId}" has no preview.`);
      }

      return {
        content: [
          {
            type: "image",
            data: Buffer.from(preview.bytes).toString("base64"),
            mimeType: preview.type
          }
        ]
      };
    }
  );

  server.registerTool(
    "catalog_tag",
    {
      description: "Save a named restore point of an asset. Tag before a " +
        "bulk or scripted edit so catalog_restore can undo it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        name: z.string(),
        message: z.string().optional()
      })
    },
    async({ assetId, name, message }) => {
      const { catalog } = await session.golem();
      const tag = await catalog.tag(assetId, name, message);

      return jsonResult({
        assetId: tag.assetId,
        name: tag.name,
        createdAt: tag.createdAt
      });
    }
  );

  server.registerTool(
    "catalog_restore",
    {
      description: "Put an asset back to a tag made with catalog_tag. " +
        "Every later edit, yours or a person's, is replaced.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        tag: z.string()
      }),
      annotations: {
        destructiveHint: true
      }
    },
    async({ assetId, tag }) => {
      const { catalog } = await session.golem();

      return jsonResult(await catalog.restore(assetId, tag));
    }
  );
}
