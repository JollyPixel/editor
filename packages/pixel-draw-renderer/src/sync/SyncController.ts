// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "../buffer/hooks.ts";
import type { HistoryController } from "../history/HistoryController.ts";
import type { HistoryEntryInput } from "../history/HistoryStack.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type { RGBA, Vec2 } from "../types.ts";
import { Fill } from "../tools/Fill.ts";

export interface SyncControllerOptions {
  canvasBuffer: CanvasBuffer;
  viewport: Viewport;
  renderer: CanvasRenderer;
  history: HistoryController;
  onBufferUpdated?: PixelBufferHookListener;
  /**
   * Called after a pixel mutation.
   */
  onDrawEnd?: () => void;
}

/**
 * Synchronizes canvas, rendering, history, and mutation hooks.
 */
export class SyncController {
  #canvasBuffer: CanvasBuffer;
  #viewport: Viewport;
  #renderer: CanvasRenderer;
  #history: HistoryController;
  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd?: () => void;
  #isApplyingRemote = false;

  constructor(
    options: SyncControllerOptions
  ) {
    this.#canvasBuffer = options.canvasBuffer;
    this.#viewport = options.viewport;
    this.#renderer = options.renderer;
    this.#history = options.history;
    this.#onBufferUpdated = options.onBufferUpdated;
    this.#onDrawEnd = options.onDrawEnd;
  }

  /**
   * Replaces the local buffer-mutation listener.
   */
  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#onBufferUpdated = fn;
  }

  /**
   * Records a local history entry.
   */
  recordHistory(
    entry: HistoryEntryInput
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }

    this.#history.push(entry);
  }

  /**
   * Emits a local buffer mutation.
   */
  emitHook(
    event: PixelBufferHookEvent
  ): void {
    if (this.#isApplyingRemote || !this.#onBufferUpdated) {
      return;
    }

    this.#onBufferUpdated(event);
  }

  applyStroke(
    color: RGBA,
    positions: Vec2[]
  ): void {
    this.#canvasBuffer.drawPixels(positions, color);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
  }

  resizeTexture(
    size: Vec2
  ): void {
    this.#canvasBuffer.resize(size);
    this.#viewport.texture.resize(size);
    this.#renderer.drawFrame();
  }

  replacePixels(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#canvasBuffer.replacePixels(pixels, size);
    this.#viewport.texture.resize(size);
    this.#renderer.drawFrame();
  }

  /**
   * Applies a remote mutation without emitting it.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#isApplyingRemote = true;
    try {
      switch (event.action) {
        case "stroke":
          this.applyStroke(
            event.metadata.color,
            event.metadata.positions
          );
          this.#onDrawEnd?.();
          break;

        case "resized":
          this.resizeTexture(event.metadata.size);
          this.#history.clear();
          break;

        case "texture-replaced":
          this.replacePixels(
            event.metadata.size,
            new Uint8ClampedArray(
              toUint8Array(event.metadata.pixels)
            )
          );
          this.#history.clear();
          break;

        case "global-fill": {
          const positions = Fill.matchAll(this.#canvasBuffer, event.metadata.fromColor);
          this.applyStroke(event.metadata.toColor, positions);
          this.#onDrawEnd?.();
          break;
        }
      }
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  /**
   * Replaces the buffer from a remote snapshot.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.replacePixels(size, pixels);
      this.#history.clear();
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }
}
