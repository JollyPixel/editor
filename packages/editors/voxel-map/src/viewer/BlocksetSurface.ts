// Import Third-party Dependencies
import {
  RectArea,
  type PixelDocument,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  BlocksetDocument,
  BlocksetDocumentListener
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

export interface BlocksetSurfaceOptions {
  pixels: PixelDocument;
  blockset: BlocksetDocument;
}

export type BlocksetSurfaceEvents = {
  reset: () => void;
  changed: (bounds: SelectionRect) => void;
  settled: (bounds: SelectionRect) => void;
};

export class BlocksetSurface extends Emitter<BlocksetSurfaceEvents> {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
  #normalMapped: boolean;
  #changed: RectArea | null = null;
  #unsettled: RectArea | null = null;
  #needsReset = false;
  #scheduled = false;
  #disposed = false;

  readonly #onChanged = (event: { bounds: SelectionRect; }): void => {
    this.#changed = this.#changed?.union(event.bounds) ??
      RectArea.from(event.bounds);
    this.#schedule();
  };

  readonly #onReset = (): void => {
    this.#needsReset = true;
    this.#schedule();
  };

  readonly #onNormalMapChanged = (): void => {
    const normalMapped = this.pixels.normalMap !== null;
    if (normalMapped !== this.#normalMapped) {
      this.#normalMapped = normalMapped;
      this.#onReset();
    }
  };

  readonly #onBlocksetCommand: BlocksetDocumentListener = (command) => {
    if (command.action === "tile-size-updated") {
      this.#onReset();
    }
  };

  readonly #tick = (): void => {
    this.#scheduled = false;
    if (!this.#disposed) {
      this.#flush();
    }
  };

  constructor(
    options: BlocksetSurfaceOptions
  ) {
    super();
    this.pixels = options.pixels;
    this.blockset = options.blockset;
    this.#normalMapped = this.pixels.normalMap !== null;

    this.pixels.on("changed", this.#onChanged);
    this.pixels.on("normal-map-changed", this.#onNormalMapChanged);
    this.pixels.on("resized", this.#onReset);
    this.pixels.on("replaced", this.#onReset);
    this.blockset.on("loaded", this.#onReset);
    this.blockset.on("command", this.#onBlocksetCommand);
  }

  dispose(): void {
    this.#disposed = true;
    this.pixels.off("changed", this.#onChanged);
    this.pixels.off("normal-map-changed", this.#onNormalMapChanged);
    this.pixels.off("resized", this.#onReset);
    this.pixels.off("replaced", this.#onReset);
    this.blockset.off("loaded", this.#onReset);
    this.blockset.off("command", this.#onBlocksetCommand);
  }

  #schedule(): void {
    if (this.#scheduled || this.#disposed) {
      return;
    }

    this.#scheduled = true;
    requestAnimationFrame(this.#tick);
  }

  #flush(): void {
    if (this.#needsReset) {
      this.#needsReset = false;
      this.#changed = null;
      this.#unsettled = null;
      this.emit("reset");

      return;
    }

    const changed = this.#changed;
    if (changed !== null) {
      this.#changed = null;
      this.#unsettled = this.#unsettled?.union(changed.bounds) ?? changed;
      this.emit("changed", changed.bounds);
      this.#schedule();

      return;
    }

    const unsettled = this.#unsettled;
    if (unsettled !== null) {
      this.#unsettled = null;
      this.emit("settled", unsettled.bounds);
    }
  }
}
