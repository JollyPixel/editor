// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { voxelModelEditableKind } from "../network/server.ts";
import {
  addBlocksInputSchema,
  addMaterialsInputSchema
} from "./ModelSpecs.ts";
import { VoxelModelAsset } from "./VoxelModelAsset.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);

export const VOXEL_MODEL_GOLEM_KIND = golemKind(
  voxelModelEditableKind(),
  VoxelModelAsset,
  {
    guide: kGuide,
    intents: {
      addBlocks: golemIntent({
        description: "Add blocks. Answers the new blocks as { id, name, " +
          "uv, shared }: uv is the rect of the block's faces on the model's " +
          "texture, to paint with that texture's intents; shared is true " +
          "when the texture was full and the faces overlap another block's.",
        input: addBlocksInputSchema,
        run: (model: VoxelModelAsset, input) => model.addBlocks(input)
      }),
      addMaterials: golemIntent({
        description: "Add materials. Blocks take a material by name or id. " +
          "Answers the new materials as { id, name }.",
        input: addMaterialsInputSchema,
        run: (model: VoxelModelAsset, input) => model.addMaterials(input)
      })
    }
  }
);
