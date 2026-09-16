// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type {
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelCanvasChangeTracker,
  type PixelCanvasChangeFlush
} from "../change-tracking/PixelCanvasChangeTracker.ts";
import type { PixelTextureSource } from "../change-tracking/types.ts";

export type PixelCanvasTextureFlush = PixelCanvasChangeFlush;

export interface PixelCanvasTextureOptions {
  /**
   * The filter mode to use for the texture.
   * @default "nearest"
   */
  filter?: "nearest" | "linear";
  /**
   * The color space to use for the texture.
   * @default THREE.SRGBColorSpace
   */
  colorSpace?: THREE.ColorSpace;
  /**
   * The flush mode to use for the texture.
   * @default "frame"
   */
  flush?: PixelCanvasTextureFlush;
  /**
   * Test scheduler override.
   */
  scheduler?: (callback: () => void) => void;
}

export type PixelCanvasTextureEvent = {
  resized: (event: { size: Vec2; }) => void;
};

export class PixelCanvasTexture extends Emitter<PixelCanvasTextureEvent> {
  readonly texture: THREE.CanvasTexture;

  readonly #source: PixelTextureSource;
  readonly #changes: PixelCanvasChangeTracker;
  #disposed = false;

  constructor(
    source: PixelTextureSource,
    options: PixelCanvasTextureOptions = {}
  ) {
    super();
    this.#source = source;

    const threeFilter = options.filter === "linear" ?
      THREE.LinearFilter :
      THREE.NearestFilter;

    this.texture = new THREE.CanvasTexture(source.textureCanvas());
    this.texture.magFilter = threeFilter;
    this.texture.minFilter = threeFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;

    this.#changes = new PixelCanvasChangeTracker(source, {
      flush: options.flush,
      scheduler: options.scheduler
    });
    this.#changes.on("consumed", this.#onConsumed);
    this.#changes.on("resized", this.#onResized);
    this.#changes.on("replaced", this.#onReplaced);
  }

  consume(): SelectionRect | null {
    return this.#changes.consume();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#changes.off("consumed", this.#onConsumed);
    this.#changes.off("resized", this.#onResized);
    this.#changes.off("replaced", this.#onReplaced);
    this.#changes.dispose();
    this.texture.dispose();
  }

  readonly #onConsumed = (): void => {
    this.texture.needsUpdate = true;
  };

  readonly #onResized = (event: { size: Vec2; }): void => {
    this.emit("resized", event);
  };

  readonly #onReplaced = (event: { size: Vec2; }): void => {
    this.texture.image = this.#source.textureCanvas();
    this.emit("resized", event);
  };
}
