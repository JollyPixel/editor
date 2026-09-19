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

const kUVSlotSchema = defineSchema({
  type: "string",
  minLength: 1
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

const kQuarterTurnSchema = defineSchema({
  enum: [0, 1, 2, 3]
});

const kUVRectSchema = defineSchema({
  ...kTextureRectSchema,
  properties: {
    ...kTextureRectSchema.properties,
    rotation: kQuarterTurnSchema
  }
});

const kNormalizedRectSchema = defineSchema({
  type: "object",
  properties: {
    x: { type: "number", minimum: 0 },
    y: { type: "number", minimum: 0 },
    width: { type: "number", exclusiveMinimum: 0, maximum: 1 },
    height: { type: "number", exclusiveMinimum: 0, maximum: 1 }
  },
  required: [
    "x",
    "y",
    "width",
    "height"
  ]
});

const kTriangleCornerSchema = defineSchema({
  enum: [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right"
  ]
});

function triangleSchema(
  rect: JSONSchema,
  extra: Record<string, JSONSchema> = {}
): JSONSchema {
  return {
    type: "object",
    properties: {
      shape: { const: "triangle" },
      corner: kTriangleCornerSchema,
      rect,
      ...extra
    },
    required: [
      "shape",
      "corner",
      "rect"
    ]
  };
}

const kUVGeometrySchema: JSONSchema = {
  oneOf: [
    kUVRectSchema,
    triangleSchema(kTextureRectSchema, { rotation: kQuarterTurnSchema }),
    {
      type: "object",
      properties: {
        shape: { const: "compound" },
        rect: kTextureRectSchema,
        rotation: kQuarterTurnSchema,
        parts: {
          type: "array",
          minItems: 1,
          items: {
            oneOf: [
              kNormalizedRectSchema,
              triangleSchema(kNormalizedRectSchema)
            ]
          }
        }
      },
      required: [
        "shape",
        "rect",
        "parts"
      ]
    }
  ]
};

const kUVFacesSchema: JSONSchema = {
  type: "object",
  minProperties: 1,
  propertyNames: kUVSlotSchema,
  additionalProperties: kUVGeometrySchema
};

const kUVRegionIdentityProperties = {
  id: { type: "string", minLength: 1 },
  color: { type: "string" },
  name: { type: "string" },
  activeFaces: {
    type: "array",
    minItems: 1,
    items: kUVSlotSchema
  }
} as const;

const kUVRegionSchema: JSONSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        ...kUVRegionIdentityProperties,
        state: { const: "stacked" },
        rect: kUVRectSchema,
        faces: kUVFacesSchema,
        stackedFace: kUVSlotSchema
      },
      required: [
        "id",
        "color",
        "state",
        "rect"
      ]
    },
    {
      type: "object",
      properties: {
        ...kUVRegionIdentityProperties,
        state: { enum: ["unfolded", "free"] },
        faces: kUVFacesSchema
      },
      required: [
        "id",
        "color",
        "state",
        "faces"
      ]
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

export const pixelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
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
        region: kUVRegionSchema
      }),
      pixelCommand("uv-region-deleted", {
        id: { type: "string" }
      }),
      pixelCommand("uv-region-moved", {
        id: { type: "string" },
        face: { type: ["string", "null"], minLength: 1 },
        rect: kTextureRectSchema
      }),
      pixelCommand("uv-region-state-changed", {
        region: kUVRegionSchema
      }),
      pixelCommand(
        "uv-region-rotated",
        {
          id: { type: "string" },
          face: kUVSlotSchema,
          geometry: kUVGeometrySchema
        },
        {
          id: { type: "string" },
          face: { type: "null" },
          region: kUVRegionSchema
        }
      )
    ]
  }
});

export const pixelSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    size: kSizeSchema,
    pixels: { type: "string" },
    uvRegions: {
      type: "array",
      items: kUVRegionSchema
    }
  },
  required: [
    "size",
    "pixels"
  ]
};
