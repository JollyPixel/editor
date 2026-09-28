// Import Third-party Dependencies
import {
  commandVariant,
  defineSchema,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import { uvLayoutSchema } from "@jolly-pixel/asset.pixel-art/server";

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
    uv: uvLayoutSchema
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

export const voxelModelSnapshotSchema = defineSchema({
  type: "object",
  properties: {
    nodes: { type: "array", items: modelNodeSchema }
  },
  required: ["nodes"]
});

export const voxelModelCommandSchema = defineSchema({
  oneOf: [
    commandVariant("node-added", {
      node: modelNodeSchema
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
    })
  ]
});

export const voxelModelCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: voxelModelCommandSchema.oneOf.map(withCommandHeader)
});
