// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "../buffer/hooks.ts";
import type { HistoryController } from "../history/HistoryController.ts";
import type { HistoryEntryInput } from "../history/HistoryStack.types.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type { UVRegion } from "../uv/UVRegion.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import { Fill } from "../tools/Fill.ts";

export interface SyncControllerOptions {
  canvasBuffer: CanvasBuffer;
  viewport: Viewport;
  renderer: CanvasRenderer;
  history: HistoryController;
  uvMap: UVMap;
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
  #uvMap: UVMap;
  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd?: () => void;
  #isApplyingRemote = false;
  #isReplayingHistory = false;

  constructor(
    options: SyncControllerOptions
  ) {
    this.#canvasBuffer = options.canvasBuffer;
    this.#viewport = options.viewport;
    this.#renderer = options.renderer;
    this.#history = options.history;
    this.#uvMap = options.uvMap;
    this.#onBufferUpdated = options.onBufferUpdated;
    this.#onDrawEnd = options.onDrawEnd;

    this.#uvMap.on(
      "region-created",
      (event) => this.#handleUvCreated(event.region)
    );
    this.#uvMap.on(
      "region-deleted",
      (event) => this.#handleUvDeleted(event.region)
    );
    this.#uvMap.on(
      "region-moved",
      (event) => this.#handleUvMoved(event.region, event.previousRect)
    );
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
          const positions = Fill.matchAll(
            this.#canvasBuffer,
            event.metadata.fromColor
          );
          this.applyStroke(
            event.metadata.toColor,
            positions
          );
          this.#onDrawEnd?.();
          break;
        }

        case "uv-region-created":
          this.#uvMap.restore(event.metadata.region);
          break;

        case "uv-region-deleted":
          this.#uvMap.delete(event.metadata.id);
          break;

        case "uv-region-moved":
          this.#uvMap.move(
            event.metadata.id,
            event.metadata.rect
          );
          break;
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
    pixels: Uint8ClampedArray,
    uvRegions: UVRegion[] = []
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.replacePixels(size, pixels);
      this.#uvMap.clear();
      for (const region of uvRegions) {
        this.#uvMap.restore(region);
      }
      this.#history.clear();
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  /**
   * Runs `fn` while suppressing local history recording, but not network
   * broadcast — used to replay undo/redo of UV region changes without
   * re-recording the replay as a new entry.
   */
  runHistoryReplay<T>(
    fn: () => T
  ): T {
    this.#isReplayingHistory = true;
    try {
      return fn();
    }
    finally {
      this.#isReplayingHistory = false;
    }
  }

  #handleUvCreated(
    region: UVRegion
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-create",
        region
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-created",
      metadata: { region }
    });
  }

  #handleUvDeleted(
    region: UVRegion
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-delete",
        region
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-deleted",
      metadata: {
        id: region.id
      }
    });
  }

  #handleUvMoved(
    region: UVRegion,
    previousRect: SelectionRect
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-move",
        id: region.id,
        oldRect: previousRect,
        newRect: region.rect
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-moved",
      metadata: {
        id: region.id,
        rect: region.rect
      }
    });
  }
}
