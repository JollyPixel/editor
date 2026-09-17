// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  serverMessageProtocol,
  type JSONSchema,
  type MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { MODEL_HOOK_ACTIONS } from "../features/groups/hooks.ts";

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

const vector3Schema: JSONSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" }
  },
  required: ["x", "y", "z"]
};

const transformSchema: JSONSchema = {
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
};

const parentUuidSchema: JSONSchema = {
  type: ["string", "null"]
};

const mirrorAxesSchema: JSONSchema = {
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
    parentUuid: parentUuidSchema,
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
};

export const modelSnapshotSchema: JSONSchema = {
  type: "array",
  items: modelNodeSchema
};

export const modelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      commandVariant("group-added", {
        uuid: { type: "string" },
        name: { type: "string" },
        transform: transformSchema
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
        parentUuid: parentUuidSchema,
        transform: transformSchema
      }),
      commandVariant("group-reparented-local", {
        uuid: { type: "string" },
        parentUuid: parentUuidSchema
      }),
      commandVariant("group-transformed", {
        uuid: { type: "string" },
        transform: transformSchema
      }, {
        flipAxes: mirrorAxesSchema
      })
    ]
  }
});

export const MODEL_COMMAND_ACTIONS: readonly string[] = MODEL_HOOK_ACTIONS;

export const modelProtocols: MessageProtocols = {
  inbound: modelCommandProtocol,
  outbound: serverMessageProtocol({
    command: modelCommandProtocol,
    snapshot: modelSnapshotSchema
  })
};
