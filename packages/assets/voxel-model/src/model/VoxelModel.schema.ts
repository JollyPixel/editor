// Import Third-party Dependencies
import { uvLayoutSchema } from "@jolly-pixel/asset.pixel-art/server";
import * as z from "zod/mini";

// Import Internal Dependencies
import { materialSurfaceSchema } from "./materials/MaterialSurface.ts";
import { BLOCK_SHAPE_PARAMETERS } from "./nodes/BlockShape.ts";

// CONSTANTS
const kNullableIdSchema = z.nullable(z.string());
const { sides, ringSides, thickness } = BLOCK_SHAPE_PARAMETERS;
const kSidesSchema = z.int().check(z.minimum(sides.min), z.maximum(sides.max));
const kRingSidesSchema = z.int().check(
  z.minimum(ringSides.min),
  z.maximum(ringSides.max)
);
const kThicknessSchema = z.number().check(
  z.minimum(thickness.min),
  z.maximum(thickness.max)
);

export const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export const mirrorAxesSchema = z.object({
  x: z.boolean(),
  y: z.boolean(),
  z: z.boolean()
});

export const blockTransformSchema = z.object({
  position: vector3Schema,
  pivotOffset: vector3Schema,
  size: vector3Schema,
  scale: vector3Schema,
  rotation: vector3Schema
});

export const blockShapeSchema = z.union([
  z.strictObject({
    type: z.enum(["box", "plane"])
  }),
  z.strictObject({
    type: z.enum(["cylinder", "cone"]),
    sides: kSidesSchema
  }),
  z.strictObject({
    type: z.literal("torus"),
    sides: kSidesSchema,
    ringSides: kRingSidesSchema,
    thickness: kThicknessSchema
  })
]);

export const modelMaterialSchema = z.object({
  kind: z.literal("material"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string(),
  surface: materialSurfaceSchema
});

export const folderNodeSchema = z.object({
  kind: z.literal("folder"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string()
});

export const materialFolderSchema = folderNodeSchema;

export const materialEntrySchema = z.discriminatedUnion("kind", [
  materialFolderSchema,
  modelMaterialSchema
]);

export const blockNodeSchema = z.object({
  kind: z.literal("block"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string(),
  transform: blockTransformSchema,
  flipAxes: mirrorAxesSchema,
  shape: blockShapeSchema,
  uv: uvLayoutSchema,
  materialId: z.optional(z.string())
});

export const modelNodeSchema = z.discriminatedUnion("kind", [
  folderNodeSchema,
  blockNodeSchema
]);

export const nodeTransformSchema = z.object({
  id: z.string(),
  transform: blockTransformSchema
});

const kRemapTargetSchema = z.nullable(z.string().check(z.minLength(1)));
const kBindingPathSchema = z.string().check(z.minLength(1));

export const animationBindingSchema = z.object({
  path: kBindingPathSchema,
  target: kRemapTargetSchema
});

export const animationSetLinkSchema = z.object({
  id: z.string(),
  kind: z.string(),
  bindings: z.array(animationBindingSchema),
  own: z.optional(z.boolean())
});

export const voxelModelSnapshotSchema = z.object({
  nodes: z.array(modelNodeSchema),
  materials: z.array(materialEntrySchema),
  animationSets: z.array(animationSetLinkSchema)
});
