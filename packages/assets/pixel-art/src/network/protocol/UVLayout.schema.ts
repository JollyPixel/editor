// Import Third-party Dependencies
import { minProperties } from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kQuarterTurnSchema = z.literal([0, 1, 2, 3]);
const kTriangleCornerSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
]);

export const uvSlotSchema = z.string().check(z.minLength(1));

export const textureRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().check(z.gt(0)),
  height: z.number().check(z.gt(0))
});

const kUVRectSchema = z.extend(textureRectSchema, {
  rotation: z.optional(kQuarterTurnSchema)
});

const kNormalizedRectSchema = z.object({
  x: z.number().check(z.minimum(0)),
  y: z.number().check(z.minimum(0)),
  width: z.number().check(z.gt(0), z.maximum(1)),
  height: z.number().check(z.gt(0), z.maximum(1))
});

function triangleSchema<
  TRect extends z.ZodMiniType,
  const TExtra extends z.core.$ZodLooseShape
>(
  rect: TRect,
  extra: TExtra
) {
  return z.object({
    shape: z.literal("triangle"),
    corner: kTriangleCornerSchema,
    rect,
    ...extra
  });
}

export const uvGeometrySchema = z.union([
  kUVRectSchema,
  triangleSchema(textureRectSchema, {
    rotation: z.optional(kQuarterTurnSchema)
  }),
  z.object({
    shape: z.literal("compound"),
    rect: textureRectSchema,
    rotation: z.optional(kQuarterTurnSchema),
    parts: z.array(z.union([
      kNormalizedRectSchema,
      triangleSchema(kNormalizedRectSchema, {})
    ])).check(z.minLength(1))
  })
]);

const kUVFacesSchema = minProperties(
  z.record(uvSlotSchema, uvGeometrySchema),
  1
);

const kActiveFacesSchema = z.array(uvSlotSchema).check(z.minLength(1));

const kStackedLayoutShape = {
  state: z.literal("stacked"),
  rect: kUVRectSchema,
  faces: z.optional(kUVFacesSchema),
  activeFaces: z.optional(kActiveFacesSchema),
  stackedFace: z.optional(uvSlotSchema)
};

const kUnfoldedLayoutShape = {
  state: z.enum(["unfolded", "free"]),
  faces: kUVFacesSchema,
  activeFaces: z.optional(kActiveFacesSchema)
};

const kRegionIdentityShape = {
  id: z.string().check(z.minLength(1)),
  color: z.string(),
  name: z.optional(z.string())
};

export const uvLayoutSchema = z.union([
  z.object(kStackedLayoutShape),
  z.object(kUnfoldedLayoutShape)
]);

export const uvRegionSchema = z.union([
  z.object({
    ...kRegionIdentityShape,
    ...kStackedLayoutShape
  }),
  z.object({
    ...kRegionIdentityShape,
    ...kUnfoldedLayoutShape
  })
]);
