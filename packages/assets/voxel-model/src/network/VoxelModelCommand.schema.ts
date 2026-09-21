// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  defineSchema,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";

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
    flipAxes: mirrorAxesSchema
  },
  required: ["kind", "id", "parentId", "name", "transform"]
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
    })
  ]
});

export const voxelModelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: voxelModelCommandSchema.oneOf.map(networkVariant)
  }
});

/**
 * Shape of one command as it travels without its network header, so `Infer`
 * yields the bare command union the editor works with.
 */
type CommandVariant<
  TAction extends string,
  TRequired extends Record<string, JSONSchema>,
  TOptional extends Record<string, JSONSchema>
> = {
  [keyword: string]: unknown;
  type: "object";
  properties: { action: { const: TAction; }; } & TRequired & TOptional;
  required: ("action" | Extract<keyof TRequired, string>)[];
};

function commandVariant<
  const TAction extends string,
  const TRequired extends Record<string, JSONSchema>,
  const TOptional extends Record<string, JSONSchema> = Record<never, never>
>(
  action: TAction,
  properties: TRequired,
  optionalProperties: TOptional = {} as TOptional
): CommandVariant<TAction, TRequired, TOptional> {
  return {
    type: "object",
    properties: {
      action: { const: action },
      ...properties,
      ...optionalProperties
    },
    required: [
      "action",
      ...Object.keys(properties) as Extract<keyof TRequired, string>[]
    ]
  };
}

function networkVariant(
  variant: JSONSchema
): JSONSchema {
  return {
    ...variant,
    properties: {
      ...commandHeaderProperties,
      ...variant.properties
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      ...variant.required ?? []
    ]
  };
}
