// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ColorPalette,
  type PixelArtCanvas,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  ColorController,
  type ColorControllerOptions
} from "../../../src/color/ColorController.ts";
import type { PaletteRampSpace } from "../../../src/color/PaletteState.ts";
import type { ColorChangeDetail } from "../../../src/color/ColorSwatch.ts";
import type { TextureSetEvents } from "../../../src/textures/TextureSet.ts";
import { createElementHost as createHost } from "../../fixtures/host.ts";

// CONSTANTS
export const BLACK = { r: 0, g: 0, b: 0, a: 255 };
export const WHITE = { r: 255, g: 255, b: 255, a: 255 };

export class FakeColorOptions implements ColorControllerOptions {
  readonly messages: string[] = [];
  space: PaletteRampSpace = "oklab";

  notify = (
    message: string
  ): void => {
    this.messages.push(message);
  };

  rampSpace = (): PaletteRampSpace => this.space;
}

export class FakeDocument {
  palette = ColorPalette.create();
  pixels = new Uint8ClampedArray(4);
  replaced = 0;
  readonly buffer = {
    pixels: () => this.pixels
  };
  readonly #listeners = new Set<(index: number | null) => void>();

  subscribe(
    _event: "palette-changed",
    listener: (index: number | null) => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  changePaletteColor(
    index: number,
    color: RGBA8
  ): void {
    this.palette = this.palette.withColor(index, color);
    for (const listener of this.#listeners) {
      listener(index);
    }
  }

  replacePalette(
    palette: ColorPalette
  ): void {
    this.palette = palette;
    this.replaced++;
    for (const listener of this.#listeners) {
      listener(null);
    }
  }
}

class FakeBrushColor {
  hex: string;
  opacity: number;

  constructor(
    hex: string,
    opacity = 1
  ) {
    this.hex = hex;
    this.opacity = opacity;
  }

  set(
    hex: string,
    opacity = 1
  ): void {
    this.hex = hex;
    this.opacity = opacity;
  }

  asString(): string {
    return this.hex;
  }
}

interface FakeBrush {
  primary: FakeBrushColor;
  secondary: FakeBrushColor;
  swapColors(): void;
}

export function makeCanvas(): {
  canvas: PixelArtCanvas;
  brush: FakeBrush;
  doc: FakeDocument;
} {
  const brush: FakeBrush = {
    primary: new FakeBrushColor("#111111"),
    secondary: new FakeBrushColor("#eeeeee", 0.5),
    swapColors() {
      [brush.primary, brush.secondary] = [brush.secondary, brush.primary];
    }
  };
  const doc = new FakeDocument();
  const element = document.createElement("canvas");
  const canvas = {
    brush,
    document: doc,
    canvas: () => element
  } as unknown as PixelArtCanvas;

  return {
    canvas,
    brush,
    doc
  };
}

export function color(
  hex: string,
  opacity = 1
): ColorChangeDetail {
  return {
    hex,
    opacity
  };
}

export function setup() {
  const host = createHost();
  const { canvas, brush, doc } = makeCanvas();
  const options = new FakeColorOptions();
  const controller = new ColorController(
    host,
    () => canvas,
    new Emitter<TextureSetEvents>(),
    options
  );

  return {
    host,
    controller,
    options,
    brush,
    doc
  };
}
