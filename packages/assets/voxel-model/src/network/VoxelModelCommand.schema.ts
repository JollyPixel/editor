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

export const groupTransformSchema = defineSchema({
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

export const modelNodeSchema = defineSchema({
  type: "object",
  properties: {
    uuid: { type: "string" },
    name: { type: "string" },
    parentUuid: kNullableIdSchema,
    position: vector3Schema,
    pivotOffset: vector3Schema,
    size: vector3Schema,
    scale: vector3Schema,
    rotation: vector3Schema,
    flipAxes: mirrorAxesSchema
  },
  required: [
    "uuid",
    "name",
    "parentUuid",
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
    uuid: { type: "string" },
    name: { type: "string" },
    parentId: kNullableIdSchema
  },
  required: ["uuid", "name", "parentId"]
});

export const folderPlacementSchema = defineSchema({
  type: "object",
  properties: {
    blockUuid: { type: "string" },
    folderId: { type: "string" }
  },
  required: ["blockUuid", "folderId"]
});

export const voxelModelSnapshotSchema = defineSchema({
  type: "object",
  properties: {
    nodes: { type: "array", items: modelNodeSchema },
    folders: { type: "array", items: folderNodeSchema },
    placements: { type: "array", items: folderPlacementSchema }
  },
  required: ["nodes", "folders", "placements"]
});

export const modelCommandSchema = defineSchema({
  oneOf: [
    commandVariant("group-added", {
      uuid: { type: "string" },
      name: { type: "string" },
      transform: groupTransformSchema
    }),
    commandVariant("group-removed", {
      uuid: { type: "string" }
    }),
    commandVariant("group-renamed", {
      uuid: { type: "string" },
      name: { type: "string" }
    }),
    commandVariant("group-reparented", {
      uuid: { type: "string" },
      parentUuid: kNullableIdSchema,
      transform: groupTransformSchema
    }),
    commandVariant("group-reparented-local", {
      uuid: { type: "string" },
      parentUuid: kNullableIdSchema
    }),
    commandVariant("group-transformed", {
      uuid: { type: "string" },
      transform: groupTransformSchema
    }, {
      flipAxes: mirrorAxesSchema
    })
  ]
});

export const folderCommandSchema = defineSchema({
  oneOf: [
    commandVariant("folder-added", {
      uuid: { type: "string" },
      name: { type: "string" },
      parentId: kNullableIdSchema
    }),
    commandVariant("folder-removed", {
      uuid: { type: "string" }
    }),
    commandVariant("folder-renamed", {
      uuid: { type: "string" },
      name: { type: "string" }
    }),
    commandVariant("folder-reparented", {
      uuid: { type: "string" },
      parentId: kNullableIdSchema
    }),
    commandVariant("block-placed", {
      blockUuid: { type: "string" },
      folderId: { type: "string" }
    }),
    commandVariant("block-unplaced", {
      blockUuid: { type: "string" }
    })
  ]
});

export const voxelModelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      ...modelCommandSchema.oneOf.map(networkVariant),
      ...folderCommandSchema.oneOf.map(networkVariant)
    ]
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
