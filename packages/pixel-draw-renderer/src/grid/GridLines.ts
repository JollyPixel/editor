// Import Third-party Dependencies
import {
  assertColor,
  contrastingColor,
  formatRgba
} from "@jolly-pixel/color";

// Import Internal Dependencies
import type { TextureGrid } from "./TextureGrid.ts";
import type { DefaultViewport } from "../rendering/Viewport.ts";
import type { Vec2 } from "../types.ts";

// CONSTANTS
const kMinCellScreenSize = 4;
const kCasingDash = [3, 3];
const kSolidLine: number[] = [];

export interface GridLinesOptions {
  grid: TextureGrid;
  viewport: DefaultViewport;
}

export class GridLines {
  readonly #grid: TextureGrid;
  readonly #viewport: DefaultViewport;
  #casingCache = {
    color: "",
    value: ""
  };

  constructor(
    options: GridLinesOptions
  ) {
    this.#grid = options.grid;
    this.#viewport = options.viewport;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    textureSize: Vec2
  ): void {
    const { size, visible, color } = this.#grid;
    const { zoom, camera } = this.#viewport;
    if (!visible || size * zoom.value < kMinCellScreenSize) {
      return;
    }

    const width = textureSize.x * zoom.value;
    const height = textureSize.y * zoom.value;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    for (let x = size; x < textureSize.x; x += size) {
      const screenX = Math.round(camera.x + (x * zoom.value)) + 0.5;
      ctx.moveTo(screenX, camera.y);
      ctx.lineTo(screenX, camera.y + height);
    }
    for (let y = size; y < textureSize.y; y += size) {
      const screenY = Math.round(camera.y + (y * zoom.value)) + 0.5;
      ctx.moveTo(camera.x, screenY);
      ctx.lineTo(camera.x + width, screenY);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash(kCasingDash);
    ctx.strokeStyle = this.#casing(color);
    ctx.stroke();
    ctx.setLineDash(kSolidLine);
  }

  #casing(
    color: string
  ): string {
    if (this.#casingCache.color !== color) {
      this.#casingCache = {
        color,
        value: formatRgba({
          ...assertColor(contrastingColor(color)),
          a: assertColor(color).a
        })
      };
    }

    return this.#casingCache.value;
  }
}
