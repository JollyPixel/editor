// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { ENVIRONMENT_PRESET_NAMES } from "../asset/environment.ts";

// CONSTANTS
const kColor = z.string().check(z.describe("Hex, such as \"#ffd9a0\"."));
const kIntensity = z.number().check(z.gte(0));

export const environmentPatchSchema = z.object({
  sky: z.optional(z.object({
    kind: z.optional(z.enum(["none", "color", "day", "night"]).check(
      z.describe("none clears to the renderer's color; day and night are " +
        "procedural skies lit along the sun direction.")
    )),
    color: z.optional(kColor.check(z.describe("Only for kind color.")))
  })),
  sun: z.optional(z.nullable(z.object({
    color: z.optional(kColor),
    intensity: z.optional(kIntensity),
    azimuth: z.optional(z.number().check(
      z.describe("Degrees around +Y, from +Z toward +X.")
    )),
    elevation: z.optional(z.number().check(
      z.gte(-90),
      z.lte(90),
      z.describe("Degrees above the horizon.")
    ))
  })).check(z.describe("A directional light. null turns it off."))),
  ambient: z.optional(z.object({
    skyColor: z.optional(kColor),
    groundColor: z.optional(kColor),
    intensity: z.optional(kIntensity)
  }).check(z.describe("A hemisphere light; equal colors give a flat light."))),
  reflections: z.optional(z.object({
    kind: z.optional(z.enum(["none", "room"])),
    intensity: z.optional(kIntensity)
  })),
  fog: z.optional(z.object({
    kind: z.optional(z.enum(["none", "linear", "exp2"])),
    color: z.optional(kColor),
    near: z.optional(z.number().check(
      z.gte(0),
      z.describe("World units, for kind linear.")
    )),
    far: z.optional(z.number().check(
      z.gte(0),
      z.describe("World units, for kind linear.")
    )),
    density: z.optional(z.number().check(
      z.gte(0),
      z.describe("For kind exp2, such as 0.02.")
    ))
  })),
  toneMapping: z.optional(z.object({
    kind: z.optional(z.enum(["none", "neutral", "aces", "agx"])),
    exposure: z.optional(kIntensity)
  })),
  glow: z.optional(z.nullable(z.object({
    strength: z.optional(kIntensity),
    radius: z.optional(z.number().check(z.gte(0), z.lte(1)))
  })).check(z.describe("Bloom on emissive and bright surfaces. null turns it off."))),
  voxel: z.optional(z.object({
    blockLightFalloff: z.optional(z.enum(["wide", "focused"])),
    shadowFill: z.optional(kIntensity.check(
      z.describe("How much block light fills shadows.")
    ))
  }).check(z.describe("Read by voxel maps and voxel models only.")))
});

export const environmentChangeSchema = z.extend(environmentPatchSchema, {
  preset: z.optional(z.enum(ENVIRONMENT_PRESET_NAMES).check(
    z.describe("Start every section from this preset, then apply the " +
      "sections given.")
  ))
});

export type EnvironmentPatch = z.output<typeof environmentPatchSchema>;

export type EnvironmentChange = z.output<typeof environmentChangeSchema>;
