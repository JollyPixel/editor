// Import Internal Dependencies
import type { Vec2 } from "../types.ts";

export interface ViewportTextureOptions {
  size: Vec2;
  /**
   * Called after the texture is resized, so the owning Viewport can react
   * (e.g. re-clamp the camera, since its bounds depend on the texture size).
   */
  onResize?: () => void;
}

/**
 * Holds the dimensions of the texture displayed in a Viewport, and the
 * size/bounds computations that only depend on those dimensions.
 */
export class ViewportTexture {
  #size: Vec2;
  #onResize?: () => void;

  constructor(
    options: ViewportTextureOptions
  ) {
    this.#size = structuredClone(options.size);
    this.#onResize = options.onResize;
  }

  get size(): Readonly<Vec2> {
    return this.#size;
  }

  resize(
    size: Vec2
  ): void {
    this.#size = structuredClone(size);
    this.#onResize?.();
  }

  pixelSize(
    zoom: number
  ): Vec2 {
    return {
      x: this.#size.x * zoom,
      y: this.#size.y * zoom
    };
  }

  contains(
    pos: Vec2
  ): boolean {
    return pos.x >= 0 && pos.x < this.#size.x &&
      pos.y >= 0 && pos.y < this.#size.y;
  }
}
