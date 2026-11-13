// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import { MAX_QUERY_CELLS } from "../../assets/voxelMap/VoxelMapAsset.ts";
import { MAX_BOX_CELLS } from "../../assets/voxelMap/VoxelBox.ts";
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kCell = z.object({
  x: z.int(),
  y: z.int(),
  z: z.int()
});
const kBox = {
  min: kCell.describe("The lowest cell of the box, included. y is up."),
  max: kCell.describe(`The highest cell, included. At most ${MAX_BOX_CELLS} cells.`)
};
const kLayer = z.string()
  .describe("A layer name or id, from voxelmap_summary.");
const kBlock = z.union([z.string(), z.int()])
  .describe("A block name, \"<blockset>/<name>\" when two blocksets share it, or a block id.");

export function registerVoxelMapTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "voxelmap_summary",
    {
      description: "A voxel map's layers with their bounds and voxel " +
        "counts, its blocksets and the blocks you can place.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId }) => {
      const map = await session.open(assetId, "voxelmap");

      return jsonResult(await map.summary());
    }
  );

  server.registerTool(
    "voxelmap_query",
    {
      description: "The occupied cells of a box in a voxel map, as " +
        `{ x, y, z, block, layer }. At most ${MAX_QUERY_CELLS} cells; ` +
        "query smaller boxes, or a heightmap, for more.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        ...kBox,
        layer: kLayer.optional()
          .describe("Only this layer. Default: the visible result of all layers.")
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId, min, max, layer }) => {
      const map = await session.open(assetId, "voxelmap");

      return jsonResult(map.query({ min, max }, { layer }));
    }
  );

  server.registerTool(
    "voxelmap_heightmap",
    {
      description: "The top occupied y of each column in a box, seen from " +
        "above: one row per z, one value per x, null for an empty column.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        ...kBox,
        layer: kLayer.optional()
          .describe("Only this layer. Default: all layers.")
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId, min, max, layer }) => {
      const map = await session.open(assetId, "voxelmap");

      return jsonResult(map.heightmap({ min, max }, { layer }));
    }
  );

  server.registerTool(
    "voxelmap_add_layer",
    {
      description: "Add an empty layer to a voxel map, and wait until the " +
        "studio accepts it. Returns its id and its name, which gets a " +
        "number appended when another layer has it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        name: z.string(),
        above: kLayer.optional()
          .describe("The layer to put it right above. Default: on top.")
      })
    },
    async({ assetId, name, above }) => {
      const map = await session.open(assetId, "voxelmap");
      const layer = await map.addLayer(name, { above });
      await map.settled();

      return jsonResult({
        assetId,
        layer
      });
    }
  );

  server.registerTool(
    "voxelmap_fill_box",
    {
      description: "Fill every cell of a box on one layer with a block, " +
        "and wait until the studio accepts it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        layer: kLayer,
        ...kBox,
        block: kBlock
      })
    },
    async({ assetId, layer, min, max, block }) => {
      const map = await session.open(assetId, "voxelmap");
      const written = await map.fillBox({ min, max }, block, { layer });
      await map.settled();

      return jsonResult({
        assetId,
        written
      });
    }
  );

  server.registerTool(
    "voxelmap_clear_box",
    {
      description: "Empty every cell of a box on one layer, and wait until " +
        "the studio accepts it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        layer: kLayer,
        ...kBox
      })
    },
    async({ assetId, layer, min, max }) => {
      const map = await session.open(assetId, "voxelmap");
      const cleared = await map.clearBox({ min, max }, { layer });
      await map.settled();

      return jsonResult({
        assetId,
        cleared
      });
    }
  );
}
