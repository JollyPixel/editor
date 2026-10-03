// Import Third-party Dependencies
import type { JSONSchema } from "@jolly-pixel/network";
import {
  NORMAL_MAP_BEVEL_PROFILES,
  NORMAL_MAP_BORDERS,
  NORMAL_MAP_HEIGHTS
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kNonNegative: JSONSchema = {
  type: "number",
  minimum: 0
};

const kSettingsProperties: Record<string, JSONSchema> = {
  height: { enum: [...NORMAL_MAP_HEIGHTS] },
  invert: { type: "boolean" },
  strength: kNonNegative,
  border: { enum: [...NORMAL_MAP_BORDERS] },
  bevel: {
    type: "object",
    properties: {
      width: { type: "number", exclusiveMinimum: 0 },
      profile: { enum: [...NORMAL_MAP_BEVEL_PROFILES] }
    },
    required: ["width", "profile"]
  },
  edgeIntensity: kNonNegative,
  levels: {
    anyOf: [
      { const: 0 },
      { type: "integer", minimum: 3, not: { multipleOf: 2 } }
    ]
  }
};

export const normalMapSettingsPatchSchema: JSONSchema = {
  type: "object",
  properties: kSettingsProperties
};

export const normalMapSettingsSchema: JSONSchema = {
  type: "object",
  properties: kSettingsProperties,
  required: Object.keys(kSettingsProperties)
};

export const normalMapZoneSchema: JSONSchema = {
  type: "object",
  properties: {
    regionId: { type: "string", minLength: 1 },
    settings: {
      oneOf: [
        { const: "off" },
        normalMapSettingsPatchSchema
      ]
    }
  },
  required: ["regionId", "settings"]
};

export const normalMapDataSchema: JSONSchema = {
  type: "object",
  properties: {
    defaults: normalMapSettingsSchema,
    zones: {
      type: "array",
      items: normalMapZoneSchema
    }
  },
  required: ["defaults", "zones"]
};
