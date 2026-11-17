// Import Third-party Dependencies
import { pixelIntents } from "@jolly-pixel/asset.pixel-art/golem";
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  blocksetEditableKind,
  voxelMapEditableKind
} from "../network/server.ts";
import { BlocksetAsset } from "./BlocksetAsset.ts";
import { MAX_BOX_CELLS } from "./VoxelBox.ts";
import {
  MAX_QUERY_CELLS,
  VoxelMapAsset
} from "./VoxelMapAsset.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);
const kCell = z.object({
  x: z.int(),
  y: z.int(),
  z: z.int()
});
const kBox = {
  min: kCell.check(z.describe("The lowest cell of the box, included. y is up.")),
  max: kCell.check(
    z.describe(`The highest cell, included. At most ${MAX_BOX_CELLS} cells.`)
  )
};
const kLayer = z.string().check(z.describe("A layer name or id, from summary."));
const kBlock = z.union([z.string(), z.int()]).check(z.describe(
  "A block name, \"<blockset>/<name>\" when two blocksets share it, or a block id."
));

export const VOXEL_MAP_GOLEM_KIND = golemKind(voxelMapEditableKind(), VoxelMapAsset, {
  guide: kGuide,
  intents: {
    summary: golemIntent({
      description: "The map's layers with their bounds and voxel counts, " +
        "its blocksets and the blocks you can place.",
      input: z.object({}),
      run: (map: VoxelMapAsset) => map.summary()
    }),
    query: golemIntent({
      description: "The occupied cells of a box, as " +
        `{ x, y, z, block, layer }. At most ${MAX_QUERY_CELLS} cells; ` +
        "query smaller boxes, or a heightmap, for more.",
      input: z.object({
        ...kBox,
        layer: z.optional(kLayer.check(
          z.describe("Only this layer. Default: the visible result of all layers.")
        ))
      }),
      run: async(map: VoxelMapAsset, { min, max, layer }) => (
        map.query({ min, max }, { layer })
      )
    }),
    heightmap: golemIntent({
      description: "The top occupied y of each column in a box, seen " +
        "from above: one row per z, one value per x, null for an empty column.",
      input: z.object({
        ...kBox,
        layer: z.optional(kLayer.check(
          z.describe("Only this layer. Default: all layers.")
        ))
      }),
      run: async(map: VoxelMapAsset, { min, max, layer }) => (
        map.heightmap({ min, max }, { layer })
      )
    }),
    addLayer: golemIntent({
      description: "Add an empty layer. Answers its id and its name, " +
        "which gets a number appended when another layer has it.",
      input: z.object({
        name: z.string(),
        above: z.optional(kLayer.check(
          z.describe("The layer to put it right above. Default: on top.")
        ))
      }),
      run: async(map: VoxelMapAsset, { name, above }) => {
        return {
          layer: await map.addLayer(name, { above })
        };
      }
    }),
    fillBox: golemIntent({
      description: "Fill every cell of a box on one layer with a block.",
      input: z.object({
        layer: kLayer,
        ...kBox,
        block: kBlock
      }),
      run: async(map: VoxelMapAsset, { layer, min, max, block }) => {
        return {
          written: await map.fillBox({ min, max }, block, { layer })
        };
      }
    }),
    clearBox: golemIntent({
      description: "Empty every cell of a box on one layer.",
      input: z.object({
        layer: kLayer,
        ...kBox
      }),
      run: async(map: VoxelMapAsset, { layer, min, max }) => {
        return {
          cleared: await map.clearBox({ min, max }, { layer })
        };
      }
    })
  }
});

export const BLOCKSET_GOLEM_KIND = golemKind(blocksetEditableKind(), BlocksetAsset, {
  guide: kGuide,
  intents: pixelIntents()
});
