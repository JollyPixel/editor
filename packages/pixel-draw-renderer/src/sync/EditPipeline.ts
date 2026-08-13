// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

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
import type {
  UVFace,
  UVRegion,
  UVRegionData
} from "../uv/UVRegion.ts";
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
import type { FillGlobalCommit } from "../tools/FillEngine.ts";
import type { SelectEditEntry } from "../tools/SelectEngine.ts";
import {
  applyColorGroups,
  groupPositionsByColor
} from "../buffer/colorGroups.ts";

export interface EditPipelineOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  viewport: Viewport;
  renderer: CanvasRenderer;
  history: History;
  uvMap: UVMap;
  onBufferUpdated?: PixelBufferHookListener;
  onDrawEnd?: () => void;
}

/**
 * Centralizes buffer mutation, history, hooks, and draw-end ordering.
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
      (event) => this.#handleUvMoved(event.region, event.face, event.previousRect)
    );
    this.#uvMap.on(
      "region-state-changed",
      (event) => this.#handleUvStateChanged(event.region, event.previous)
    );
  }

  get onBufferUpdated(): PixelBufferHookListener | undefined {
    return this.#onBufferUpdated;
  }

  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#onBufferUpdated = fn;
  }

  /**
   * Records and emits a stroke already applied live by the brush.
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
   * Applies pixels before recording and emitting the stroke.
   */
  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary",
    uniformBeforeColor?: RGBA
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const color = this.#brush[slot].asRGBA();
    let beforeColors: RGBA[] = [];
    if (this.#history.enabled) {
      beforeColors = uniformBeforeColor ?
        pixels.map(() => uniformBeforeColor) :
        this.#canvasBuffer.samplePixels(pixels);
    }

    this.#applyStroke(color, pixels);
    this.commitStroke(pixels, color, beforeColors);
  }

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
   * Selection hooks carry final per-pixel colors because content is nonuniform.
   */
  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#recordHistory({
      action: "select-edit",
      ...entry
    });
    this.emitHook({
      action: "select-edit",
      metadata: {
        positions: entry.positions,
        colors: entry.afterColors
      }
    });
    this.#onDrawEnd?.();
  }

  resize(
    size: Vec2
  ): void {
    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ?
      this.#canvasBuffer.pixels() :
      null;

    this.#resizeTexture(size);

    if (beforePixels) {
      this.#recordHistory({
        action: "resized",
        beforeSize,
        beforePixels,
        afterSize: structuredClone(size),
        afterPixels: this.#canvasBuffer.pixels()
      });
    }

    this.emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    const beforeSize = this.#canvasBuffer.size();
    const beforePixels = this.#history.enabled ?
      this.#canvasBuffer.pixels() :
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
        afterPixels: this.#canvasBuffer.pixels()
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
   * Public so undo and redo can replay hook events through the same path.
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
    // drawPixels repaints; copyToMaster only persists the visible result.
    this.#canvasBuffer.drawPixels(positions, color);
    this.#canvasBuffer.copyToMaster();
  }

  #applySelectEdit(
    positions: Vec2[],
    colors: RGBA[]
  ): void {
    applyColorGroups(
      this.#canvasBuffer,
      groupPositionsByColor(positions, colors)
    );
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

        case "select-edit":
          this.#applySelectEdit(
            event.metadata.positions,
            event.metadata.colors
          );
          this.#onDrawEnd?.();
          break;

        case "uv-region-created":
          this.#uvMap.restore(event.metadata.region);
          break;

        case "uv-region-deleted":
          this.#uvMap.delete(event.metadata.id);
          break;

        case "uv-region-moved":
          this.#uvMap.move(
            event.metadata.id,
            event.metadata.rect,
            event.metadata.face ?? undefined
          );
          break;

        case "uv-region-state-changed":
          this.#uvMap.restoreState(event.metadata.region);
          break;
      }
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = []
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
   * Suppresses history recording, but not network broadcast, during replay.
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
    const data = region.toJSON();
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-create",
        region: data
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-created",
      metadata: { region: data }
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
        region: region.toJSON()
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
    face: UVFace | null,
    previousRect: SelectionRect
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    const rect = region.rectFor(face ?? "front");
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-move",
        id: region.id,
        face,
        oldRect: previousRect,
        newRect: rect
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-moved",
      metadata: {
        id: region.id,
        face,
        rect
      }
    });
  }

  #handleUvStateChanged(
    region: UVRegion,
    previous: UVRegionData
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    const data = region.toJSON();
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-state",
        id: region.id,
        before: previous,
        after: data
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-state-changed",
      metadata: { region: data }
    });
  }
}
