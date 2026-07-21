// Import Third-party Dependencies
import { fromUint8Array, toUint8Array } from "js-base64";

// Import Internal Dependencies
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "../buffer/hooks.ts";
import type { History } from "../history/History.ts";
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
import type {
  Brush,
  BrushColorSlot
} from "../tools/Brush.ts";
import type { FillGlobalCommit } from "../tools/FillController.ts";
import type { SelectEditEntry } from "../tools/SelectController.ts";
import { toRGBA } from "../utils/colors.ts";

export interface EditPipelineOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  viewport: Viewport;
  renderer: CanvasRenderer;
  history: History;
  uvMap: UVMap;
  onBufferUpdated?: PixelBufferHookListener;
  /**
   * Called after a pixel mutation.
   */
  onDrawEnd?: () => void;
}

/**
 * The single place where an edit becomes buffer mutation + history + hook +
 * `onDrawEnd`. Tools call one intent method per edit kind
 * (`commitStroke`, `commitPixels`, `commitGlobalFill`, `commitSelectionEdit`)
 * and `PixelArtCanvas` calls `resize` / `replaceTexture`; none of them have
 * to sequence the underlying primitives themselves.
 */
export class EditPipeline {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #viewport: Viewport;
  #renderer: CanvasRenderer;
  #history: History;
  #uvMap: UVMap;
  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd?: () => void;
  #isApplyingRemote = false;
  #isReplayingHistory = false;

  constructor(
    options: EditPipelineOptions
  ) {
    this.#brush = options.brush;
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
   * Commits an already-applied stroke (the buffer is mutated live as the
   * brush stamps, so this only records + emits + signals draw-end).
   */
  commitStroke(
    pixels: Vec2[],
    color: RGBA,
    beforeColors: RGBA[]
  ): void {
    this.#recordHistory({
      action: "stroke",
      positions: pixels,
      beforeColors,
      afterColor: color
    });
    this.emitHook({
      action: "stroke",
      metadata: { color, positions: pixels }
    });
    this.#onDrawEnd?.();
  }

  /**
   * Commits pixels as a stroke edit, resolving the color from the brush and
   * applying them to the buffer first (used by line, fill, and the public
   * `PixelArtCanvas.commitPixels`, where the buffer is not yet mutated).
   */
  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary"
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const color = toRGBA(this.#brush[slot].asString());
    const beforeColors = this.#history.enabled ?
      this.#canvasBuffer.samplePixels(pixels) :
      [];

    this.#applyStroke(color, pixels);
    this.commitStroke(pixels, color, beforeColors);
  }

  /**
   * Commits a global fill (recolors all matching pixels).
   */
  commitGlobalFill(
    commit: FillGlobalCommit
  ): void {
    const { positions, beforeColors, fromColor, toColor } = commit;

    this.#applyStroke(toColor, positions);
    this.#recordHistory({
      action: "stroke",
      positions,
      beforeColors,
      afterColor: toColor
    });
    this.emitHook({
      action: "global-fill",
      metadata: { fromColor, toColor }
    });
    this.#onDrawEnd?.();
  }

  /**
   * Commits a selection edit (move / rotate / flip / paste / delete).
   *
   * NOTE: unlike `commitStroke` / `commitGlobalFill`, a selection edit emits
   * no network hook. This asymmetry is preserved from the pre-`EditPipeline`
   * behavior; it now lives in one place should selection edits ever need to
   * sync over the network.
   */
  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#recordHistory({
      action: "select-edit",
      ...entry
    });
    this.#onDrawEnd?.();
  }

  /**
   * Resizes the texture, recording the before/after snapshots and emitting a
   * `resized` hook.
   */
  resize(
    size: Vec2
  ): void {
    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ?
      Uint8ClampedArray.from(this.#canvasBuffer.pixels()) :
      null;

    this.#resizeTexture(size);

    if (beforePixels) {
      this.#recordHistory({
        action: "resized",
        beforeSize,
        beforePixels,
        afterSize: structuredClone(size),
        afterPixels: Uint8ClampedArray.from(
          this.#canvasBuffer.pixels()
        )
      });
    }

    this.emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  /**
   * Replaces the whole texture from an image/canvas source, recording the
   * before/after snapshots and emitting a `texture-replaced` hook.
   */
  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ?
      Uint8ClampedArray.from(this.#canvasBuffer.pixels()) :
      null;

    this.#canvasBuffer.loadTexture(source);
    const size = this.#canvasBuffer.size();
    this.#viewport.texture.resize(size);
    this.#renderer.drawFrame();

    if (beforePixels) {
      this.#recordHistory({
        action: "texture-replaced",
        beforeSize,
        beforePixels,
        afterSize: size,
        afterPixels: Uint8ClampedArray.from(
          this.#canvasBuffer.pixels()
        )
      });
    }

    this.emitHook({
      action: "texture-replaced",
      metadata: {
        size,
        pixels: fromUint8Array(
          new Uint8Array(this.#canvasBuffer.pixels())
        )
      }
    });
  }

  /**
   * Emits a local buffer mutation. Public because undo/redo replay their
   * hook events through it.
   */
  emitHook(
    event: PixelBufferHookEvent
  ): void {
    if (this.#isApplyingRemote || !this.#onBufferUpdated) {
      return;
    }

    this.#onBufferUpdated(event);
  }

  #recordHistory(
    entry: HistoryEntryInput
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }

    this.#history.push(entry);
  }

  #applyStroke(
    color: RGBA,
    positions: Vec2[]
  ): void {
    // drawPixels emits "changed"; the view repaints. copyToMaster persists the
    // stroke to the master buffer (no visible change, so no repaint).
    this.#canvasBuffer.drawPixels(positions, color);
    this.#canvasBuffer.copyToMaster();
  }

  #resizeTexture(
    size: Vec2
  ): void {
    this.#canvasBuffer.resize(size);
    this.#viewport.texture.resize(size);
    this.#renderer.drawFrame();
  }

  #replacePixels(
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
          this.#applyStroke(
            event.metadata.color,
            event.metadata.positions
          );
          this.#onDrawEnd?.();
          break;

        case "resized":
          this.#resizeTexture(event.metadata.size);
          this.#history.clear();
          break;

        case "texture-replaced":
          this.#replacePixels(
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
          this.#applyStroke(
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
      this.#replacePixels(size, pixels);
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
