// Import Third-party Dependencies
import {
  golemIntent,
  type GolemIntents
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  MAX_READ_PIXELS,
  type PixelSurface
} from "./PixelSurface.ts";

// CONSTANTS
const kColor = z.string().check(z.describe("\"#rrggbb\" or \"#rrggbbaa\"."));
const kRect = {
  x: z.int().check(z.gte(0), z.describe("The left column, from 0.")),
  y: z.int().check(z.gte(0), z.describe("The top row, from 0.")),
  width: z.int().check(z.gte(1)),
  height: z.int().check(z.gte(1))
};

export interface PaintableAsset {
  readonly pixels: PixelSurface;
}

export function pixelIntents<
  TAsset extends PaintableAsset
>(): GolemIntents<TAsset> {
  return {
    readPixels: golemIntent({
      description: "The colors of a rect of the texture, one row per y, " +
        `as "#rrggbbaa". At most ${MAX_READ_PIXELS} pixels.`,
      input: z.object(kRect),
      run: async(asset: TAsset, rect) => asset.pixels.readPixels(rect)
    }),
    paint: golemIntent({
      description: "Paint single pixels of the texture.",
      input: z.object({
        pixels: z.array(z.object({
          x: z.int().check(z.gte(0)),
          y: z.int().check(z.gte(0)),
          color: kColor
        }))
      }),
      run: async(asset: TAsset, { pixels }) => {
        return {
          painted: await asset.pixels.paintPixels(pixels)
        };
      }
    }),
    fillRect: golemIntent({
      description: "Fill a rect of the texture with one color.",
      input: z.object({
        ...kRect,
        color: kColor
      }),
      run: async(asset: TAsset, { color, ...rect }) => {
        return {
          painted: await asset.pixels.fillRect(rect, color)
        };
      }
    }),
    replacePalette: golemIntent({
      description: "Replace the palette people pick colors from in the " +
        "pixel-art editor. It does not repaint pixels.",
      input: z.object({
        colors: z.array(kColor).check(z.minLength(1))
      }),
      run: async(asset: TAsset, { colors }) => {
        await asset.pixels.replacePalette(colors);

        return {
          colors: colors.length
        };
      }
    })
  };
}
