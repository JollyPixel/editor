// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { materialSurfaceSchema } from "../model/materials/MaterialSurface.ts";
import {
  blockShapeSchema,
  blockTransformSchema
} from "../model/VoxelModel.schema.ts";

export const blockSpecSchema = z.object({
  name: z.string(),
  shape: z.optional(blockShapeSchema.check(z.describe("Default box."))),
  transform: z.optional(z.partial(blockTransformSchema).check(z.describe(
    "Relative to the parent node, y is up. rotation is in degrees, size in " +
    "voxels. Missing fields: position, rotation and pivotOffset 0, size and " +
    "scale 1."
  ))),
  material: z.optional(z.string().check(z.describe("A material name or id.")))
});

export const materialSpecSchema = z.object({
  name: z.string(),
  surface: z.optional(z.partial(materialSurfaceSchema).check(z.describe(
    "color and emissive as lowercase hex, such as \"#ff8800\". Default: " +
    "white, opaque, fully rough, not metallic, no glow."
  )))
});

export const addBlocksInputSchema = z.object({
  parent: z.optional(z.nullable(z.string()).check(
    z.describe("The node name or id to add under. Default: the root.")
  )),
  blocks: z.array(blockSpecSchema)
});

export const addMaterialsInputSchema = z.object({
  materials: z.array(materialSpecSchema)
});

export type BlockSpec = z.output<typeof blockSpecSchema>;

export type MaterialSpec = z.output<typeof materialSpecSchema>;

export type AddBlocksInput = z.output<typeof addBlocksInputSchema>;

export type AddMaterialsInput = z.output<typeof addMaterialsInputSchema>;
