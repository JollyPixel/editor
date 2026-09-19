// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";

// CONSTANTS
const kVector3Schema: JSONSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" }
  },
  required: ["x", "y", "z"]
};

const kTransformSchema: JSONSchema = {
  type: "object",
  properties: {
    position: kVector3Schema,
    pivotOffset: kVector3Schema,
    size: kVector3Schema,
    scale: kVector3Schema,
    rotation: kVector3Schema
  },
  required: [
    "position",
    "pivotOffset",
    "size",
    "scale",
    "rotation"
  ]
};

const kNullableIdSchema: JSONSchema = {
  type: ["string", "null"]
};

const kMirrorAxesSchema: JSONSchema = {
  type: "object",
  properties: {
    x: { type: "boolean" },
    y: { type: "boolean" },
    z: { type: "boolean" }
  },
  required: ["x", "y", "z"]
};

export const modelNodeSchema: JSONSchema = {
  type: "object",
  properties: {
    uuid: { type: "string" },
    name: { type: "string" },
    parentUuid: kNullableIdSchema,
    position: kVector3Schema,
    pivotOffset: kVector3Schema,
    size: kVector3Schema,
    scale: kVector3Schema,
    rotation: kVector3Schema,
    flipAxes: kMirrorAxesSchema
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
};

export const folderNodeSchema: JSONSchema = {
  type: "object",
  properties: {
    uuid: { type: "string" },
    name: { type: "string" },
    parentId: kNullableIdSchema
  },
  required: ["uuid", "name", "parentId"]
};

export const folderPlacementSchema: JSONSchema = {
  type: "object",
  properties: {
    blockUuid: { type: "string" },
    folderId: { type: "string" }
  },
  required: ["blockUuid", "folderId"]
};

export const voxelModelSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    nodes: { type: "array", items: modelNodeSchema },
    folders: { type: "array", items: folderNodeSchema },
    placements: { type: "array", items: folderPlacementSchema }
  },
  required: ["nodes", "folders", "placements"]
};

export const voxelModelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      commandVariant("group-added", {
        uuid: { type: "string" },
        name: { type: "string" },
        transform: kTransformSchema
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
        transform: kTransformSchema
      }),
      commandVariant("group-reparented-local", {
        uuid: { type: "string" },
        parentUuid: kNullableIdSchema
      }),
      commandVariant("group-transformed", {
        uuid: { type: "string" },
        transform: kTransformSchema
      }, {
        flipAxes: kMirrorAxesSchema
      }),
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
  }
});

function commandVariant(
  action: string,
  properties: Record<string, JSONSchema>,
  optionalProperties: Record<string, JSONSchema> = {}
): JSONSchema {
  return {
    type: "object",
    properties: {
      ...commandHeaderProperties,
      action: { const: action },
      ...properties,
      ...optionalProperties
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      "action",
      ...Object.keys(properties)
    ]
  };
}
