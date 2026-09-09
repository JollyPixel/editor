// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  defineSchema,
  serverMessageProtocol,
  type JSONSchema,
  type MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// CONSTANTS
const kVec2Schema = defineSchema({
  type: "object",
  properties: {
    x: { type: "integer" },
    y: { type: "integer" }
  },
  required: [
    "x",
    "y"
  ]
});

const kSizeSchema = defineSchema({
  type: "object",
  properties: {
    x: { type: "integer", exclusiveMinimum: 0 },
    y: { type: "integer", exclusiveMinimum: 0 }
  },
  required: [
    "x",
    "y"
  ]
});

const kRgba8Schema = defineSchema({
  type: "object",
  properties: {
    r: { type: "number" },
    g: { type: "number" },
    b: { type: "number" },
    a: { type: "number" }
  },
  required: [
    "r",
    "g",
    "b",
    "a"
  ]
});

const kTextureRectSchema = defineSchema({
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number", exclusiveMinimum: 0 },
    height: { type: "number", exclusiveMinimum: 0 }
  },
  required: [
    "x",
    "y",
    "width",
    "height"
  ]
});

const kUVRegionSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    color: { type: "string" },
    name: { type: "string" },
    state: { enum: ["stacked", "unfolded", "free"] }
  },
  required: [
    "id",
    "color",
    "state"
  ]
});

function pixelCommand(
  action: string,
  metadata: JSONSchema
): JSONSchema {
  return {
    type: "object",
    properties: {
      ...commandHeaderProperties,
      seq: { type: "integer", minimum: 0 },
      action: { const: action },
      metadata,
      originTimestamp: { type: "number" }
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      "action",
      "metadata"
    ]
  };
}

function metadataSchema(
  properties: Record<string, JSONSchema>
): JSONSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties)
  };
}

export const pixelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      pixelCommand("stroke", metadataSchema({
        color: kRgba8Schema,
        positions: { type: "array", items: kVec2Schema }
      })),
      pixelCommand("resized", metadataSchema({
        size: kSizeSchema
      })),
      pixelCommand("texture-replaced", metadataSchema({
        size: kSizeSchema,
        pixels: { type: "string" }
      })),
      pixelCommand("global-fill", metadataSchema({
        fromColor: kRgba8Schema,
        toColor: kRgba8Schema
      })),
      pixelCommand("select-edit", metadataSchema({
        positions: { type: "array", items: kVec2Schema },
        colors: { type: "array", items: kRgba8Schema }
      })),
      pixelCommand("uv-region-created", metadataSchema({
        region: kUVRegionSchema
      })),
      pixelCommand("uv-region-deleted", metadataSchema({
        id: { type: "string" }
      })),
      pixelCommand("uv-region-moved", metadataSchema({
        id: { type: "string" },
        face: { type: ["string", "null"], minLength: 1 },
        rect: kTextureRectSchema
      })),
      pixelCommand("uv-region-state-changed", metadataSchema({
        region: kUVRegionSchema
      }))
    ]
  }
});

export const pixelSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    size: kSizeSchema,
    pixels: { type: "string" },
    uvRegions: { type: "array" }
  },
  required: [
    "size",
    "pixels"
  ]
};

export const pixelProtocols: MessageProtocols = {
  inbound: pixelCommandProtocol,
  outbound: serverMessageProtocol({
    command: pixelCommandProtocol,
    snapshot: pixelSnapshotSchema
  })
};
