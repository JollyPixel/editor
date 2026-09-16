// Import Third-party Dependencies
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

class FakeBrushColor {
  hex: string;
  opacity: number;

  constructor(
    hex: string,
    opacity: number
  ) {
    this.hex = hex;
    this.opacity = opacity;
  }

  set(
    hex: string,
    opacity: number
  ): void {
    this.hex = hex;
    this.opacity = opacity;
  }

  asString(): string {
    return this.hex;
  }
}

export function makeToolCanvas(
  mode: Mode
) {
  const state = {
    mode,
    brush: {
      size: 1,
      primary: new FakeBrushColor("#000000", 1),
      secondary: new FakeBrushColor("#ffffff", 1)
    },
    tools: {
      brush: { pickArmed: false },
      fill: { global: false, uvClip: false },
      select: { shape: false }
    }
  };

  return {
    state,
    canvas: state as unknown as PixelArtCanvas
  };
}
