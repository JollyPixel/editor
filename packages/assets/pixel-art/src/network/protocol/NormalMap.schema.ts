// Import Third-party Dependencies
import { notMultiple } from "@jolly-pixel/network";
import {
  NORMAL_MAP_BEVEL_PROFILES,
  NORMAL_MAP_BORDERS,
  NORMAL_MAP_HEIGHTS
} from "@jolly-pixel/pixel-draw.renderer";
import * as z from "zod/mini";

// CONSTANTS
const kNonNegative = z.number().check(z.minimum(0));

const kOddLevels = notMultiple(z.int().check(z.minimum(3)), 2);

const kSettingsShape = {
  height: z.enum(NORMAL_MAP_HEIGHTS),
  invert: z.boolean(),
  strength: kNonNegative,
  border: z.enum(NORMAL_MAP_BORDERS),
  bevel: z.object({
    width: z.number().check(z.gt(0)),
    profile: z.enum(NORMAL_MAP_BEVEL_PROFILES)
  }),
  edgeIntensity: kNonNegative,
  levels: z.union([z.literal(0), kOddLevels])
};

export const normalMapSettingsSchema = z.object(kSettingsShape);

export const normalMapSettingsPatchSchema = z.partial(normalMapSettingsSchema);

export const normalMapZoneSchema = z.object({
  regionId: z.string().check(z.minLength(1)),
  settings: z.union([
    z.literal("off"),
    normalMapSettingsPatchSchema
  ])
});

export const normalMapDataSchema = z.object({
  defaults: normalMapSettingsSchema,
  zones: z.array(normalMapZoneSchema)
});
