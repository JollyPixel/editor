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
import { NormalMapTexture } from "./NormalMapTexture.ts";
import type { PixelTextureSource } from "./types.ts";

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
  "normal-map-toggled": (event: { enabled: boolean; }) => void;
};

export class PixelCanvasTexture extends Emitter<PixelCanvasTextureEvent> {
  readonly texture: THREE.CanvasTexture;

  readonly #source: PixelTextureSource;
  readonly #changes: PixelCanvasChangeTracker;
  #normal: NormalMapTexture | null = null;
  #normalEnabled: boolean;
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

    this.#normalEnabled = source.document.normalMap !== null;
    source.document.on(
      "normal-map-changed",
      this.#onNormalMapChanged
    );
  }

  normalTexture(): THREE.DataTexture | null {
    if (
      this.#disposed ||
      this.#source.document.normalMap === null
    ) {
      return null;
    }

    this.#normal ??= new NormalMapTexture(
      this.#source.document.normals
    );

    return this.#normal.texture;
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
    this.#source.document.off(
      "normal-map-changed",
      this.#onNormalMapChanged
    );
    this.#disposeNormal();
    this.texture.dispose();
  }

  readonly #onConsumed = (): void => {
    this.texture.needsUpdate = true;
  };

  readonly #onResized = (event: { size: Vec2; }): void => {
    this.#reallocate();
    this.emit("resized", event);
  };

  readonly #onReplaced = (event: { size: Vec2; }): void => {
    this.#reallocate();
    this.emit("resized", event);
  };

  readonly #onNormalMapChanged = (): void => {
    const enabled = this.#source.document.normalMap !== null;
    if (enabled === this.#normalEnabled) {
      return;
    }

    this.#normalEnabled = enabled;
    if (!enabled) {
      this.#disposeNormal();
    }
    this.emit("normal-map-toggled", { enabled });
  };

  #disposeNormal(): void {
    this.#normal?.dispose();
    this.#normal = null;
  }

  #reallocate(): void {
    this.texture.image = this.#source.textureCanvas();
    this.texture.dispose();
    this.texture.needsUpdate = true;
  }
}
