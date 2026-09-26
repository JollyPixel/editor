// Import Third-party Dependencies
import {
  defineSchema,
  type JSONSchema
} from "@jolly-pixel/network";

export const uvSlotSchema = defineSchema({
  type: "string",
  minLength: 1
});

export const textureRectSchema = defineSchema({
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
  ...textureRectSchema,
  properties: {
    ...textureRectSchema.properties,
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

function triangleSchema<
  const TRect extends JSONSchema,
  const TExtra extends Record<string, JSONSchema>
>(
  rect: TRect,
  extra: TExtra
) {
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
  } as const;
}

export const uvGeometrySchema = defineSchema({
  oneOf: [
    kUVRectSchema,
    triangleSchema(textureRectSchema, { rotation: kQuarterTurnSchema }),
    {
      type: "object",
      properties: {
        shape: { const: "compound" },
        rect: textureRectSchema,
        rotation: kQuarterTurnSchema,
        parts: {
          type: "array",
          minItems: 1,
          items: {
            oneOf: [
              kNormalizedRectSchema,
              triangleSchema(kNormalizedRectSchema, {})
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
});

const kUVFacesSchema = defineSchema({
  type: "object",
  minProperties: 1,
  propertyNames: uvSlotSchema,
  additionalProperties: uvGeometrySchema
});

const kActiveFacesSchema = defineSchema({
  type: "array",
  minItems: 1,
  items: uvSlotSchema
});

const kUVLayoutVariants = [
  {
    type: "object",
    properties: {
      state: { const: "stacked" },
      rect: kUVRectSchema,
      faces: kUVFacesSchema,
      activeFaces: kActiveFacesSchema,
      stackedFace: uvSlotSchema
    },
    required: [
      "state",
      "rect"
    ]
  },
  {
    type: "object",
    properties: {
      state: { enum: ["unfolded", "free"] },
      faces: kUVFacesSchema,
      activeFaces: kActiveFacesSchema
    },
    required: [
      "state",
      "faces"
    ]
  }
] as const satisfies readonly JSONSchema[];

/**
 * A UV region without its identity: the geometry another document stores
 * for a region it owns.
 */
export const uvLayoutSchema = defineSchema({
  oneOf: kUVLayoutVariants
});

export const uvRegionSchema: JSONSchema = {
  oneOf: kUVLayoutVariants.map((variant) => {
    return {
      ...variant,
      properties: {
        id: { type: "string", minLength: 1 },
        color: { type: "string" },
        name: { type: "string" },
        ...variant.properties
      },
      required: [
        "id",
        "color",
        ...variant.required
      ]
    };
  })
};
