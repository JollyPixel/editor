// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import type { HistoryEntry } from "./history/HistoryStack.types.ts";
import {
  DocumentEdits,
  type UVRegionFilter
} from "./sync/DocumentEdits.ts";
import type { FillGlobalCommit } from "./tools/FillEngine.ts";
import type { SelectEditEntry } from "./tools/SelectEngine.ts";
import { UVMap } from "./uv/UVMap.ts";
import {
  pointInGeometry,
  rectOf
} from "./uv/geometry.ts";
import type { UVGeometry } from "./uv/types.ts";
import type {
  UVRegion,
  UVRegionData
} from "./uv/UVRegion.ts";
import type {
  ByteColorInput,
  RGBA8,
  Vec2
} from "./types.ts";

export interface PixelDocumentOptions {
  size: Vec2;
  defaultColor?: ByteColorInput;
  maxSize?: number;
  init?: HTMLCanvasElement;
  history?: {
    enabled?: boolean;
    limit?: number;
    onChange?: (state: HistoryState) => void;
  };
  onBufferUpdated?: PixelBufferHookListener;
}

export type PixelDocumentEvent = CanvasBufferEvent & {
  "draw-end": () => void;
  "history-changed": (state: HistoryState) => void;
  reset: () => void;
};

export class PixelDocument extends Emitter<
  PixelDocumentEvent
> {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;
  readonly history: History;

  #edits: DocumentEdits;

  constructor(
    options: PixelDocumentOptions
  ) {
    super();

    this.buffer = new CanvasBuffer({
      size: options.size,
      defaultColor: options.defaultColor,
      maxSize: options.maxSize
    });

    if (options.init) {
      this.buffer.loadTexture(options.init);
    }

    this.uv = new UVMap({
      getCanvasSize: () => this.buffer.size()
    });

    const onHistoryChange = options.history?.onChange;
    this.history = new History(this.buffer, this.uv, {
      enabled: options.history?.enabled,
      limit: options.history?.limit,
      onChange: (state) => {
        onHistoryChange?.(state);
        this.emit("history-changed", state);
      }
    });

    this.#edits = new DocumentEdits({
      buffer: this.buffer,
      history: this.history,
      uvMap: this.uv,
      onDrawEnd: () => this.emit("draw-end"),
      onReset: () => this.emit("reset")
    });
    this.#edits.onBufferUpdated = options.onBufferUpdated;

    this.buffer.on("changed", (event) => this.emit("changed", event));
    this.buffer.on("resized", (event) => this.emit("resized", event));
    this.buffer.on("replaced", (event) => this.emit("replaced", event));
  }

  get onBufferUpdated(): PixelBufferHookListener | undefined {
    return this.#edits.onBufferUpdated;
  }

  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#edits.onBufferUpdated = fn;
  }

  /**
   * Hands the UV regions `filter` matches to another document until the
   * returned function is called.
   */
  disownUvRegions(
    filter: UVRegionFilter
  ): () => void {
    return this.#edits.disownUvRegions(filter);
  }

  ownsUvRegion(
    id: string
  ): boolean {
    return this.#edits.ownsUvRegion(id);
  }

  size(): Vec2 {
    return this.buffer.size();
  }

  hasTransparency(
    geometry: UVGeometry
  ): boolean {
    if (!("shape" in geometry)) {
      return this.buffer.hasTransparency(geometry);
    }

    const bounds = rectOf(geometry);
    const maxX = Math.ceil(bounds.x + bounds.width);
    const maxY = Math.ceil(bounds.y + bounds.height);
    for (let y = Math.floor(bounds.y); y < maxY; y++) {
      for (let x = Math.floor(bounds.x); x < maxX; x++) {
        if (
          pointInGeometry(
            { x: x + 0.5, y: y + 0.5 },
            geometry
          ) &&
          this.buffer.samplePixel(x, y)[3] < 255
        ) {
          return true;
        }
      }
    }

    return false;
  }

  commitStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#edits.commitStroke(pixels, color, beforeColors);
  }

  commitPixels(
    pixels: Vec2[],
    color: RGBA8,
    uniformBeforeColor?: RGBA8
  ): void {
    this.#edits.commitPixels(pixels, color, uniformBeforeColor);
  }

  commitGlobalFill(
    commit: FillGlobalCommit
  ): void {
    this.#edits.commitGlobalFill(commit);
  }

  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#edits.commitSelectionEdit(entry);
  }

  resize(
    size: Vec2
  ): void {
    this.#edits.resize(size);
  }

  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#edits.replaceTexture(source);
  }

  clearTexture(
    keepMask?: Uint8Array
  ): void {
    this.#edits.clearTexture(keepMask);
  }

  undo(): HistoryEntry | null {
    return this.#edits.undo();
  }

  redo(): HistoryEntry | null {
    return this.#edits.redo();
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#edits.applyRemoteCommand(event);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = []
  ): void {
    this.#edits.loadSnapshot(size, pixels, uvRegions);
  }

  runLocalRestore<T>(
    fn: () => T
  ): T {
    return this.#edits.runLocalRestore(fn);
  }
}
