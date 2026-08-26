// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type {
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelTextureSource } from "./types.ts";

export type PixelCanvasTextureFlush = "frame" | "immediate" | "manual";

export interface PixelCanvasTextureOptions {
  /**
   * @default "nearest"
   */
  filter?: "nearest" | "linear";
  /**
   * @default THREE.SRGBColorSpace
   */
  colorSpace?: THREE.ColorSpace;
  /**
   * @default "frame"
   */
  flush?: PixelCanvasTextureFlush;
  /**
   * Test scheduler override.
   */
  scheduler?: (callback: () => void) => void;
}

export type PixelCanvasTextureEvent = {
  /**
   * Fired when resize or replacement changes the canvas dimensions.
   */
  resized: (event: { size: Vec2; }) => void;
};

/**
 * Mirrors a live pixel canvas to Three.js, batching uploads per frame.
 */
export class PixelCanvasTexture extends Emitter<
  PixelCanvasTextureEvent
> {
  readonly texture: THREE.CanvasTexture;

  readonly #source: PixelTextureSource;
  readonly #flush: PixelCanvasTextureFlush;
  readonly #scheduler: (callback: () => void) => void;

  #pending: SelectionRect | null = null;
  #scheduled = false;
  #disposed = false;

  readonly #onChanged = (
    event: { bounds: SelectionRect; }
  ): void => {
    this.#markDirty(event.bounds);
  };

  readonly #onResized = (
    event: { size: Vec2; }
  ): void => {
    this.#markDirty(fullBounds(event.size));
    this.emit("resized", { size: event.size });
  };

  readonly #onReplaced = (
    event: { size: Vec2; }
  ): void => {
    // loadTexture replaces the canvas, so update the texture image.
    this.texture.image = this.#source.textureCanvas();
    this.#markDirty(fullBounds(event.size));
    this.emit("resized", { size: event.size });
  };

  constructor(
    source: PixelTextureSource,
    options: PixelCanvasTextureOptions = {}
  ) {
    super();

    const {
      filter = "nearest",
      colorSpace = THREE.SRGBColorSpace,
      flush = "frame",
      scheduler
    } = options;

    this.#source = source;
    this.#flush = flush;
    this.#scheduler = scheduler ??
      ((callback) => globalThis.requestAnimationFrame(callback));

    const threeFilter = filter === "linear" ?
      THREE.LinearFilter :
      THREE.NearestFilter;

    this.texture = new THREE.CanvasTexture(source.textureCanvas());
    this.texture.magFilter = threeFilter;
    this.texture.minFilter = threeFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = colorSpace;

    source.document.on("changed", this.#onChanged);
    source.document.on("resized", this.#onResized);
    source.document.on("replaced", this.#onReplaced);
  }

  /**
   * Applies pending changes; returns their bounds or null when unchanged.
   */
  consume(): SelectionRect | null {
    const bounds = this.#pending;
    this.#pending = null;
    if (bounds === null) {
      return null;
    }

    this.texture.needsUpdate = true;

    return bounds;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.#source.document.off("changed", this.#onChanged);
    this.#source.document.off("resized", this.#onResized);
    this.#source.document.off("replaced", this.#onReplaced);
    this.#pending = null;
    this.texture.dispose();
  }

  #markDirty(
    bounds: SelectionRect
  ): void {
    this.#pending = this.#pending === null ?
      bounds :
      unionRect(this.#pending, bounds);

    if (this.#flush === "immediate") {
      this.consume();

      return;
    }
    if (this.#flush === "manual" || this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    this.#scheduler(() => {
      this.#scheduled = false;
      if (!this.#disposed) {
        this.consume();
      }
    });
  }
}

function fullBounds(
  size: Vec2
): SelectionRect {
  return {
    x: 0,
    y: 0,
    width: size.x,
    height: size.y
  };
}

function unionRect(
  a: SelectionRect,
  b: SelectionRect
): SelectionRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
}
