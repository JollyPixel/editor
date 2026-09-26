// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  defineSchema,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  textureRectSchema,
  uvGeometrySchema,
  uvRegionSchema,
  uvSlotSchema
} from "./UVLayout.schema.ts";

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

function metadataSchema(
  properties: Record<string, JSONSchema>
): JSONSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties)
  };
}

function pixelCommand(
  action: string,
  ...variants: Record<string, JSONSchema>[]
): JSONSchema {
  return {
    type: "object",
    properties: {
      ...commandHeaderProperties,
      seq: { type: "integer", minimum: 0 },
      action: { const: action },
      metadata: variants.length === 1 ?
        metadataSchema(variants[0]) :
        { oneOf: variants.map(metadataSchema) },
      originTimestamp: { type: "number" }
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      "action",
      "metadata"
    ]
  };
}

/**
 * One schema per pixel command, for protocols that embed them.
 */
export const pixelCommandSchemas: readonly JSONSchema[] = [
  pixelCommand("stroke", {
    color: kRgba8Schema,
    positions: { type: "array", items: kVec2Schema }
  }),
  pixelCommand("resized", {
    size: kSizeSchema
  }),
  pixelCommand("texture-replaced", {
    size: kSizeSchema,
    pixels: { type: "string" }
  }),
  pixelCommand("global-fill", {
    fromColor: kRgba8Schema,
    toColor: kRgba8Schema
  }),
  pixelCommand("select-edit", {
    positions: { type: "array", items: kVec2Schema },
    colors: { type: "array", items: kRgba8Schema }
  }),
  pixelCommand("uv-region-created", {
    region: uvRegionSchema
  }),
  pixelCommand("uv-region-deleted", {
    id: { type: "string" }
  }),
  pixelCommand("uv-region-moved", {
    id: { type: "string" },
    face: { type: ["string", "null"], minLength: 1 },
    rect: textureRectSchema
  }),
  pixelCommand("uv-region-state-changed", {
    region: uvRegionSchema
  }),
  pixelCommand(
    "uv-region-rotated",
    {
      id: { type: "string" },
      face: uvSlotSchema,
      geometry: uvGeometrySchema
    },
    {
      id: { type: "string" },
      face: { type: "null" },
      region: uvRegionSchema
    }
  )
];

export const pixelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [...pixelCommandSchemas]
  }
});

export const pixelSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    size: kSizeSchema,
    pixels: { type: "string" },
    uvRegions: {
      type: "array",
      items: uvRegionSchema
    }
  },
  required: [
    "size",
    "pixels"
  ]
};
