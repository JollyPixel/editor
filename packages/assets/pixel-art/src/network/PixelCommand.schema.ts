// Import Third-party Dependencies
import {
  commandVariant,
  defineSchema,
  MessageProtocol,
  withCommandHeader,
  type JSONSchema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { PixelCommandAction } from "./pixelCommandActions.ts";
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

const kFlatIntegers = defineSchema({
  type: "array",
  items: { type: "integer" }
});

const kFlatNumbers = defineSchema({
  type: "array",
  items: { type: "number" }
});

const kPixelCommandMetadata: Record<
  PixelCommandAction,
  readonly Record<string, JSONSchema>[]
> = {
  stroke: [
    {
      color: kRgba8Schema,
      xy: kFlatIntegers
    },
    {
      color: kRgba8Schema,
      positions: { type: "array", items: kVec2Schema }
    }
  ],
  resized: [{
    size: kSizeSchema
  }],
  "texture-replaced": [{
    size: kSizeSchema,
    pixels: { type: "string" }
  }],
  "global-fill": [{
    fromColor: kRgba8Schema,
    toColor: kRgba8Schema
  }],
  "select-edit": [
    {
      xy: kFlatIntegers,
      rgba: kFlatNumbers
    },
    {
      positions: { type: "array", items: kVec2Schema },
      colors: { type: "array", items: kRgba8Schema }
    }
  ],
  "uv-region-created": [{
    region: uvRegionSchema
  }],
  "uv-region-deleted": [{
    id: { type: "string" }
  }],
  "uv-region-moved": [{
    id: { type: "string" },
    face: { type: ["string", "null"], minLength: 1 },
    rect: textureRectSchema
  }],
  "uv-region-state-changed": [{
    region: uvRegionSchema
  }],
  "uv-region-rotated": [
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
  ]
};

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
  variants: readonly Record<string, JSONSchema>[]
): JSONSchema {
  return withCommandHeader(commandVariant(action, {
    metadata: variants.length === 1 ?
      metadataSchema(variants[0]) :
      { oneOf: variants.map(metadataSchema) }
  }));
}

export const pixelCommandSchemas: readonly JSONSchema[] = Object.entries(
  kPixelCommandMetadata
).map(([action, variants]) => pixelCommand(action, variants));

export const pixelCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: [...pixelCommandSchemas]
});

export const pixelSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    size: kSizeSchema,
    pixels: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          properties: {
            format: { const: "png" },
            data: { type: "string" }
          },
          required: [
            "format",
            "data"
          ],
          additionalProperties: false
        }
      ]
    },
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
