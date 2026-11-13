// Import Third-party Dependencies
import { commandVariant } from "@jolly-pixel/network";
import { uvLayoutSchema } from "@jolly-pixel/asset.pixel-art/server";
import * as z from "zod/mini";

// Import Internal Dependencies
import { materialSurfacePatchSchema } from "../model/materials/MaterialSurface.ts";
import {
  animationSetLinkSchema,
  blockShapeSchema,
  blockTransformSchema,
  materialFolderSchema,
  mirrorAxesSchema,
  modelMaterialSchema,
  modelNodeSchema,
  nodeTransformSchema
} from "../model/VoxelModel.schema.ts";

// CONSTANTS
const kNullableIdSchema = z.nullable(z.string());
const kRemapTargetSchema = z.nullable(z.string().check(z.minLength(1)));
const kBindingPathSchema = z.string().check(z.minLength(1));

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
