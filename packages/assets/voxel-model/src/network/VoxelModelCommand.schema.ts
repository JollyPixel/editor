// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  minProperties,
  withCommandHeader
} from "@jolly-pixel/network";
import { uvLayoutSchema } from "@jolly-pixel/asset.pixel-art/server";
import * as z from "zod/mini";

// Import Internal Dependencies
import { MaterialSurface } from "../model/materials/MaterialSurface.ts";
import { BLOCK_SHAPE_PARAMETERS } from "../model/nodes/BlockShape.ts";

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
const kHexColorSchema = z.string().check(
  z.regex(new RegExp(MaterialSurface.PROPERTIES.color.pattern))
);
const kUnitSchema = z.number().check(
  z.minimum(MaterialSurface.PROPERTIES.opacity.minimum),
  z.maximum(MaterialSurface.PROPERTIES.opacity.maximum)
);
const kSurfaceShape = {
  color: kHexColorSchema,
  opacity: kUnitSchema,
  roughness: kUnitSchema,
  metalness: kUnitSchema,
  emissive: kHexColorSchema,
  emissiveIntensity: z.number().check(
    z.minimum(MaterialSurface.PROPERTIES.emissiveIntensity.minimum)
  )
} satisfies Record<(typeof MaterialSurface.KEYS)[number], z.ZodMiniType>;

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

export const materialSurfaceSchema = z.object(kSurfaceShape);

export const materialSurfacePatchSchema = minProperties(
  z.partial(z.strictObject(kSurfaceShape)),
  1
);

export const modelMaterialSchema = z.object({
  kind: z.literal("material"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string(),
  surface: materialSurfaceSchema
});

export const materialFolderSchema = z.object({
  kind: z.literal("folder"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string()
});

export const materialEntrySchema = z.discriminatedUnion("kind", [
  materialFolderSchema,
  modelMaterialSchema
]);

export const folderNodeSchema = z.object({
  kind: z.literal("folder"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string()
});

export const blockNodeSchema = z.object({
  kind: z.literal("block"),
  id: z.string(),
  parentId: kNullableIdSchema,
  name: z.string(),
  transform: blockTransformSchema,
  flipAxes: z.optional(mirrorAxesSchema),
  shape: z.optional(blockShapeSchema),
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

export const voxelModelCommandSchema = z.discriminatedUnion("action", [
  commandVariant("node-added", {
    node: modelNodeSchema,
    beforeId: z.optional(z.string())
  }),
  commandVariant("node-removed", {
    id: z.string()
  }),
  commandVariant("node-renamed", {
    id: z.string(),
    name: z.string()
  }),
  commandVariant("node-moved", {
    id: z.string(),
    parentId: kNullableIdSchema,
    transforms: z.array(nodeTransformSchema),
    beforeId: z.optional(z.string())
  }),
  commandVariant("node-transformed", {
    id: z.string(),
    transform: blockTransformSchema,
    flipAxes: z.optional(mirrorAxesSchema)
  }),
  commandVariant("node-uv-changed", {
    id: z.string(),
    uv: uvLayoutSchema
  }),
  commandVariant("node-shape-changed", {
    id: z.string(),
    shape: blockShapeSchema,
    uv: uvLayoutSchema
  }),
  commandVariant("node-material-changed", {
    id: z.string(),
    materialId: kNullableIdSchema
  }),
  commandVariant("material-added", {
    material: modelMaterialSchema,
    beforeId: z.optional(z.string())
  }),
  commandVariant("material-folder-added", {
    folder: materialFolderSchema,
    beforeId: z.optional(z.string())
  }),
  commandVariant("material-moved", {
    id: z.string(),
    parentId: kNullableIdSchema,
    beforeId: z.optional(z.string())
  }),
  commandVariant("material-removed", {
    id: z.string(),
    keepContents: z.optional(z.boolean())
  }),
  commandVariant("material-renamed", {
    id: z.string(),
    name: z.string()
  }),
  commandVariant("material-changed", {
    id: z.string(),
    surface: materialSurfacePatchSchema
  }),
  commandVariant("animation-set-linked", {
    link: animationSetLinkSchema
  }),
  commandVariant("animation-set-unlinked", {
    id: z.string()
  }),
  commandVariant("animation-set-owned", {
    id: z.string(),
    own: z.boolean()
  }),
  commandVariant("animation-binding-changed", {
    id: z.string(),
    path: kBindingPathSchema,
    target: kRemapTargetSchema
  }),
  commandVariant("animation-binding-cleared", {
    id: z.string(),
    path: kBindingPathSchema
  })
]);

export const voxelModelCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(voxelModelCommandSchema.def.options.map(withCommandHeader))
);
