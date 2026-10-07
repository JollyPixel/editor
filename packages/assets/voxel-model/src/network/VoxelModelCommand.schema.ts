// Import Third-party Dependencies
import {
  commandVariant,
  defineSchema,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import { uvLayoutSchema } from "@jolly-pixel/asset.pixel-art/server";

// Import Internal Dependencies
import {
  MATERIAL_SURFACE_KEYS,
  MATERIAL_SURFACE_PROPERTIES
} from "../model/materialSurface.ts";

// CONSTANTS
const kNullableIdSchema = defineSchema({
  type: ["string", "null"]
});

export const vector3Schema = defineSchema({
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" }
  },
  required: ["x", "y", "z"]
});

export const mirrorAxesSchema = defineSchema({
  type: "object",
  properties: {
    x: { type: "boolean" },
    y: { type: "boolean" },
    z: { type: "boolean" }
  },
  required: ["x", "y", "z"]
});

export const blockTransformSchema = defineSchema({
  type: "object",
  properties: {
    position: vector3Schema,
    pivotOffset: vector3Schema,
    size: vector3Schema,
    scale: vector3Schema,
    rotation: vector3Schema
  },
  required: [
    "position",
    "pivotOffset",
    "size",
    "scale",
    "rotation"
  ]
});

export const materialSurfaceSchema = defineSchema({
  type: "object",
  properties: MATERIAL_SURFACE_PROPERTIES,
  required: MATERIAL_SURFACE_KEYS
});

export const materialSurfacePatchSchema = defineSchema({
  type: "object",
  properties: MATERIAL_SURFACE_PROPERTIES,
  minProperties: 1,
  additionalProperties: false
});

export const modelMaterialSchema = defineSchema({
  type: "object",
  properties: {
    kind: { const: "material" },
    id: { type: "string" },
    parentId: kNullableIdSchema,
    name: { type: "string" },
    surface: materialSurfaceSchema
  },
  required: ["kind", "id", "parentId", "name", "surface"]
});

export const materialFolderSchema = defineSchema({
  type: "object",
  properties: {
    kind: { const: "folder" },
    id: { type: "string" },
    parentId: kNullableIdSchema,
    name: { type: "string" }
  },
  required: ["kind", "id", "parentId", "name"]
});

export const materialEntrySchema = defineSchema({
  oneOf: [materialFolderSchema, modelMaterialSchema]
});

export const folderNodeSchema = defineSchema({
  type: "object",
  properties: {
    kind: { const: "folder" },
    id: { type: "string" },
    parentId: kNullableIdSchema,
    name: { type: "string" }
  },
  required: ["kind", "id", "parentId", "name"]
});

export const blockNodeSchema = defineSchema({
  type: "object",
  properties: {
    kind: { const: "block" },
    id: { type: "string" },
    parentId: kNullableIdSchema,
    name: { type: "string" },
    transform: blockTransformSchema,
    flipAxes: mirrorAxesSchema,
    uv: uvLayoutSchema,
    materialId: { type: "string" }
  },
  required: ["kind", "id", "parentId", "name", "transform", "uv"]
});

export const modelNodeSchema = defineSchema({
  oneOf: [folderNodeSchema, blockNodeSchema]
});

export const nodeTransformSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    transform: blockTransformSchema
  },
  required: ["id", "transform"]
});

const kRemapTargetSchema = defineSchema({
  type: ["string", "null"],
  minLength: 1
});

export const animationBindingSchema = defineSchema({
  type: "object",
  properties: {
    path: { type: "string", minLength: 1 },
    target: kRemapTargetSchema
  },
  required: ["path", "target"]
});

export const animationSetLinkSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string" },
    bindings: { type: "array", items: animationBindingSchema },
    own: { type: "boolean" }
  },
  required: ["id", "kind", "bindings"]
});

export const voxelModelSnapshotSchema = defineSchema({
  type: "object",
  properties: {
    nodes: { type: "array", items: modelNodeSchema },
    materials: { type: "array", items: materialEntrySchema },
    animationSets: { type: "array", items: animationSetLinkSchema }
  },
  required: ["nodes", "materials", "animationSets"]
});

export const voxelModelCommandSchema = defineSchema({
  oneOf: [
    commandVariant("node-added", {
      node: modelNodeSchema
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("node-removed", {
      id: { type: "string" }
    }),
    commandVariant("node-renamed", {
      id: { type: "string" },
      name: { type: "string" }
    }),
    commandVariant("node-moved", {
      id: { type: "string" },
      parentId: kNullableIdSchema,
      transforms: { type: "array", items: nodeTransformSchema }
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("node-transformed", {
      id: { type: "string" },
      transform: blockTransformSchema
    }, {
      flipAxes: mirrorAxesSchema
    }),
    commandVariant("node-uv-changed", {
      id: { type: "string" },
      uv: uvLayoutSchema
    }),
    commandVariant("node-material-changed", {
      id: { type: "string" },
      materialId: kNullableIdSchema
    }),
    commandVariant("material-added", {
      material: modelMaterialSchema
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("material-folder-added", {
      folder: materialFolderSchema
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("material-moved", {
      id: { type: "string" },
      parentId: kNullableIdSchema
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("material-removed", {
      id: { type: "string" }
    }, {
      keepContents: { type: "boolean" }
    }),
    commandVariant("material-renamed", {
      id: { type: "string" },
      name: { type: "string" }
    }),
    commandVariant("material-changed", {
      id: { type: "string" },
      surface: materialSurfacePatchSchema
    }),
    commandVariant("animation-set-linked", {
      link: animationSetLinkSchema
    }),
    commandVariant("animation-set-unlinked", {
      id: { type: "string" }
    }),
    commandVariant("animation-set-owned", {
      id: { type: "string" },
      own: { type: "boolean" }
    }),
    commandVariant("animation-binding-changed", {
      id: { type: "string" },
      path: { type: "string", minLength: 1 },
      target: kRemapTargetSchema
    }),
    commandVariant("animation-binding-cleared", {
      id: { type: "string" },
      path: { type: "string", minLength: 1 }
    })
  ]
});

export const voxelModelCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: voxelModelCommandSchema.oneOf.map(withCommandHeader)
});
