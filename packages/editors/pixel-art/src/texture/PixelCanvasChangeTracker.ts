// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelTextureSource } from "./types.ts";

export type PixelCanvasChangeFlush = "frame" | "immediate" | "manual";

export interface PixelCanvasChangeTrackerOptions {
  /** @default "frame" */
  flush?: PixelCanvasChangeFlush;
  /** Test scheduler override. */
  scheduler?: (callback: () => void) => void;
}

export type PixelCanvasChangeTrackerEvent = {
  consumed: (event: { bounds: SelectionRect; }) => void;
  resized: (event: { size: Vec2; }) => void;
  replaced: (event: { size: Vec2; }) => void;
};

/** Collects pixel-canvas mutations without introducing a rendering dependency. */
export class PixelCanvasChangeTracker extends Emitter<
  PixelCanvasChangeTrackerEvent
> {
  readonly #source: PixelTextureSource;
  readonly #flush: PixelCanvasChangeFlush;
  readonly #scheduler: (callback: () => void) => void;

  #pending: SelectionRect | null = null;
  #scheduled = false;
  #disposed = false;

  readonly #onChanged = (event: { bounds: SelectionRect; }): void => {
    this.#markDirty(event.bounds);
  };

  readonly #onResized = (event: { size: Vec2; }): void => {
    this.#markDirty(fullBounds(event.size));
    this.emit("resized", event);
  };

  readonly #onReplaced = (event: { size: Vec2; }): void => {
    this.#markDirty(fullBounds(event.size));
    this.emit("replaced", event);
  };

  constructor(
    source: PixelTextureSource,
    options: PixelCanvasChangeTrackerOptions = {}
  ) {
    super();
    this.#source = source;
    this.#flush = options.flush ?? "frame";
    this.#scheduler = options.scheduler ??
      ((callback) => globalThis.requestAnimationFrame(callback));

    source.document.on("changed", this.#onChanged);
    source.document.on("resized", this.#onResized);
    source.document.on("replaced", this.#onReplaced);
  }

  consume(): SelectionRect | null {
    const bounds = this.#pending;
    this.#pending = null;
    if (bounds !== null) {
      this.emit("consumed", { bounds });
    }

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
  }

  #markDirty(bounds: SelectionRect): void {
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

function fullBounds(size: Vec2): SelectionRect {
  return { x: 0, y: 0, width: size.x, height: size.y };
}

function unionRect(a: SelectionRect, b: SelectionRect): SelectionRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
}
