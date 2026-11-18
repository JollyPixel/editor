// Import Third-party Dependencies
import {
  golemIntent,
  type GolemIntents
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import {
  fillRectInputSchema,
  paintPixelsInputSchema,
  pixelRectSchema,
  replacePaletteInputSchema
} from "./PixelInputs.ts";
import {
  MAX_READ_PIXELS,
  type PixelSurface
} from "./PixelSurface.ts";

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
      input: pixelRectSchema,
      run: async(asset: TAsset, rect) => asset.pixels.readPixels(rect)
    }),
    paintPixels: golemIntent({
      description: "Paint single pixels of the texture. Answers the number " +
        "of pixels painted.",
      input: paintPixelsInputSchema,
      run: (asset: TAsset, input) => asset.pixels.paintPixels(input)
    }),
    fillRect: golemIntent({
      description: "Fill a rect of the texture with one color. Answers the " +
        "number of pixels painted.",
      input: fillRectInputSchema,
      run: (asset: TAsset, input) => asset.pixels.fillRect(input)
    }),
    replacePalette: golemIntent({
      description: "Replace the palette people pick colors from in the " +
        "pixel-art editor. It does not repaint pixels.",
      input: replacePaletteInputSchema,
      run: (asset: TAsset, input) => asset.pixels.replacePalette(input)
    })
  };
}
