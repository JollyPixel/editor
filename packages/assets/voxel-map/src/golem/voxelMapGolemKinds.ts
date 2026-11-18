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
import {
  addLayerInputSchema,
  clearBoxInputSchema,
  fillBoxInputSchema,
  heightmapInputSchema,
  queryInputSchema
} from "./MapInputs.ts";
import {
  MAX_QUERY_CELLS,
  VoxelMapAsset
} from "./VoxelMapAsset.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);

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
      input: queryInputSchema,
      run: async(map: VoxelMapAsset, input) => map.query(input)
    }),
    heightmap: golemIntent({
      description: "The top occupied y of each column in a box, seen " +
        "from above: one row per z, one value per x, null for an empty column.",
      input: heightmapInputSchema,
      run: async(map: VoxelMapAsset, input) => map.heightmap(input)
    }),
    addLayer: golemIntent({
      description: "Add an empty layer. Answers its id and its name, " +
        "which gets a number appended when another layer has it.",
      input: addLayerInputSchema,
      run: (map: VoxelMapAsset, input) => map.addLayer(input)
    }),
    fillBox: golemIntent({
      description: "Fill every cell of a box on one layer with a block. " +
        "Answers the number of cells written.",
      input: fillBoxInputSchema,
      run: (map: VoxelMapAsset, input) => map.fillBox(input)
    }),
    clearBox: golemIntent({
      description: "Empty every cell of a box on one layer. Answers the " +
        "number of cells emptied.",
      input: clearBoxInputSchema,
      run: (map: VoxelMapAsset, input) => map.clearBox(input)
    })
  }
});

export const BLOCKSET_GOLEM_KIND = golemKind(blocksetEditableKind(), BlocksetAsset, {
  guide: kGuide,
  intents: pixelIntents()
});
