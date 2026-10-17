// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import { COLOR_PALETTE_SIZE } from "@jolly-pixel/pixel-draw.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { PixelCommandAction } from "./pixelCommandActions.ts";
import {
  textureRectSchema,
  uvGeometrySchema,
  uvRegionSchema,
  uvSlotSchema
} from "./UVLayout.schema.ts";
import {
  normalMapDataSchema,
  normalMapSettingsPatchSchema,
  normalMapZoneSchema
} from "./NormalMap.schema.ts";

// CONSTANTS
const kVec2Schema = z.object({
  x: z.int(),
  y: z.int()
});

export const sizeSchema = z.object({
  x: z.int().check(z.gt(0)),
  y: z.int().check(z.gt(0))
});

const kRgba8Schema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number()
});

const kChannel = z.int().check(z.minimum(0), z.maximum(255));
const kPaletteColorSchema = z.strictObject({
  r: kChannel,
  g: kChannel,
  b: kChannel,
  a: kChannel
});

const kFlatIntegers = z.array(z.int());
const kFlatNumbers = z.array(z.number());

const kPixelCommandMetadata: Record<
  PixelCommandAction,
  readonly z.core.$ZodLooseShape[]
> = {
  stroke: [
    {
      color: kRgba8Schema,
      xy: kFlatIntegers
    },
    {
      color: kRgba8Schema,
      positions: z.array(kVec2Schema)
    }
  ],
  resized: [{
    size: sizeSchema
  }],
  "texture-replaced": [{
    size: sizeSchema,
    pixels: z.string()
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
      positions: z.array(kVec2Schema),
      colors: z.array(kRgba8Schema)
    }
  ],
  "uv-region-created": [{
    region: uvRegionSchema
  }],
  "uv-region-deleted": [{
    id: z.string()
  }],
  "uv-region-moved": [{
    id: z.string(),
    face: z.nullable(z.string().check(z.minLength(1))),
    rect: textureRectSchema
  }],
  "uv-region-state-changed": [{
    region: uvRegionSchema
  }],
  "uv-region-rotated": [
    {
      id: z.string(),
      face: uvSlotSchema,
      geometry: uvGeometrySchema
    },
    {
      id: z.string(),
      face: z.null(),
      region: uvRegionSchema
    }
  ],
  "normal-map-toggled": [{
    config: z.nullable(normalMapDataSchema)
  }],
  "palette-color-changed": [{
    index: z.int().check(z.minimum(0), z.maximum(COLOR_PALETTE_SIZE - 1)),
    color: kPaletteColorSchema
  }],
  "normal-map-defaults-patched": [{
    patch: normalMapSettingsPatchSchema
  }],
  "normal-map-zone-set": [{
    zone: normalMapZoneSchema,
    index: z.int().check(z.minimum(0))
  }],
  "normal-map-zone-deleted": [{
    regionId: z.string().check(z.minLength(1))
  }]
};

function pixelCommand(
  action: string,
  variants: readonly z.core.$ZodLooseShape[]
) {
  return withCommandHeader(commandVariant(action, {
    metadata: variants.length === 1 ?
      z.object(variants[0]) :
      z.union(variants.map((variant) => z.object(variant)))
  }));
}

export const pixelCommandSchemas: readonly z.ZodMiniObject[] = Object.entries(
  kPixelCommandMetadata
).map(([action, variants]) => pixelCommand(action, variants));

export const pixelCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(pixelCommandSchemas)
);

export const pixelSnapshotSchema = z.object({
  size: sizeSchema,
  pixels: z.union([
    z.string(),
    z.strictObject({
      format: z.literal("png"),
      data: z.string()
    })
  ]),
  uvRegions: z.optional(z.array(uvRegionSchema)),
  palette: z.optional(z.array(kPaletteColorSchema).check(
    z.length(COLOR_PALETTE_SIZE)
  )),
  normalMap: z.optional(normalMapDataSchema)
});
