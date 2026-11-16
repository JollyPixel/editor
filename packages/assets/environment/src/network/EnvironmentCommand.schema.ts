// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  minProperties,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kHexColorSchema = z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/));
const kIntensitySchema = z.number().check(z.minimum(0));

const kSectionShape = {
  sky: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("none")
    }),
    z.object({
      kind: z.literal("color"),
      color: kHexColorSchema
    }),
    z.object({
      kind: z.literal("day")
    }),
    z.object({
      kind: z.literal("night")
    })
  ]),
  sun: z.nullable(z.object({
    color: kHexColorSchema,
    intensity: kIntensitySchema,
    azimuth: z.number(),
    elevation: z.number().check(z.minimum(-90), z.maximum(90))
  })),
  ambient: z.object({
    skyColor: kHexColorSchema,
    groundColor: kHexColorSchema,
    intensity: kIntensitySchema
  }),
  reflections: z.object({
    kind: z.enum(["none", "room"]),
    intensity: kIntensitySchema
  }),
  fog: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("none")
    }),
    z.object({
      kind: z.literal("linear"),
      color: kHexColorSchema,
      near: z.number().check(z.minimum(0)),
      far: z.number().check(z.minimum(0))
    }),
    z.object({
      kind: z.literal("exp2"),
      color: kHexColorSchema,
      density: z.number().check(z.minimum(0))
    })
  ]),
  toneMapping: z.object({
    kind: z.enum(["none", "neutral", "aces", "agx"]),
    exposure: kIntensitySchema
  }),
  glow: z.nullable(z.object({
    strength: kIntensitySchema,
    radius: z.number().check(z.minimum(0), z.maximum(1))
  })),
  voxel: z.object({
    blockLightFalloff: z.enum(["wide", "focused"]),
    shadowFill: kIntensitySchema
  })
};

export const environmentFileSchema = z.object({
  version: z.literal(1),
  ...kSectionShape
});

export const environmentCommandSchema = commandVariant("environment-changed", {
  set: minProperties(z.partial(z.strictObject(kSectionShape)), 1)
});

export const environmentCommandProtocol: MessageProtocol = new MessageProtocol(
  withCommandHeader(environmentCommandSchema)
);
