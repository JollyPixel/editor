// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import { voxelModelEditableKind } from "../network/server.ts";
import {
  blockSpecSchema,
  materialSpecSchema
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
        input: z.object({
          parent: z.optional(z.nullable(z.string()).check(
            z.describe("The node name or id to add under. Default: the root.")
          )),
          blocks: z.array(blockSpecSchema)
        }),
        run: async(model: VoxelModelAsset, { parent, blocks }) => {
          return {
            blocks: await model.addBlocks(blocks, { parent })
          };
        }
      }),
      addMaterials: golemIntent({
        description: "Add materials. Blocks take a material by name or id.",
        input: z.object({
          materials: z.array(materialSpecSchema)
        }),
        run: async(model: VoxelModelAsset, { materials }) => {
          return {
            materials: await model.addMaterials(materials)
          };
        }
      })
    }
  }
);
