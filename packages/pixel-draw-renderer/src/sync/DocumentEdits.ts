// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener,
  UVRegionRotation
} from "../buffer/hooks.ts";
import { History } from "../history/History.ts";
import type {
  HistoryEntry,
  HistoryEntryInput
} from "../history/HistoryStack.types.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type {
  UVSlot,
  UVRegion,
  UVRegionData
} from "../uv/UVRegion.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import { Fill } from "../tools/Fill.ts";
import type { FillGlobalCommit } from "../tools/FillEngine.ts";
import type { SelectEditEntry } from "../tools/SelectEngine.ts";
import {
  applyColorGroups,
  groupPositionsByColor
} from "../buffer/colorGroups.ts";

export interface DocumentEditsOptions {
  buffer: CanvasBuffer;
  history: History;
  uvMap: UVMap;
  onDrawEnd: () => void;
  onReset: () => void;
}

export class DocumentEdits {
  #buffer: CanvasBuffer;
  #history: History;
  #uvMap: UVMap;
  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd: () => void;
  #onReset: () => void;
  #isApplyingRemote = false;
  #isReplayingHistory = false;

  constructor(
    options: DocumentEditsOptions
  ) {
    this.#buffer = options.buffer;
    this.#history = options.history;
    this.#uvMap = options.uvMap;
    this.#onDrawEnd = options.onDrawEnd;
    this.#onReset = options.onReset;

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
    this.#uvMap.on(
      "region-rotated",
      (event) => this.#handleUvRotated(event.region, event.previous, event.face)
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

  commitStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#recordHistory({
      action: "stroke",
      positions: pixels,
      beforeColors,
      afterColor: color
    });
    this.#emitHook({
      action: "stroke",
      metadata: { color, positions: pixels }
    });
    this.#onDrawEnd();
  }

  commitPixels(
    pixels: Vec2[],
    color: RGBA8,
    uniformBeforeColor?: RGBA8
  ): void {
    if (pixels.length === 0) {
      return;
    }

    let beforeColors: RGBA8[] = [];
    if (this.#history.enabled) {
      beforeColors = uniformBeforeColor ?
        pixels.map(() => uniformBeforeColor) :
        this.#buffer.samplePixels(pixels);
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
    this.#emitHook({
      action: "global-fill",
      metadata: { fromColor, toColor }
    });
    this.#onDrawEnd();
  }

  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#recordHistory({
      action: "select-edit",
      ...entry
    });
    this.#emitHook({
      action: "select-edit",
      metadata: {
        positions: entry.positions,
        colors: entry.afterColors
      }
    });
    this.#onDrawEnd();
  }

  resize(
    size: Vec2
  ): void {
    const beforeSize = this.#buffer.size();
    const beforePixels = this.#history.enabled ?
      this.#buffer.pixels() :
      null;

    this.#buffer.resize(size);

    if (beforePixels) {
      this.#recordHistory({
        action: "resized",
        beforeSize,
        beforePixels,
        afterSize: structuredClone(size),
        afterPixels: this.#buffer.pixels()
      });
    }

    this.#emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#commitTextureReplaced(
      () => this.#buffer.loadTexture(source)
    );
  }

  clearTexture(
    keepMask?: Uint8Array
  ): void {
    const pixels = this.#buffer.pixels();
    if (keepMask) {
      for (let index = 0; index < keepMask.length; index++) {
        if (keepMask[index] === 0) {
          const byteIndex = index * 4;
          pixels[byteIndex] = 0;
          pixels[byteIndex + 1] = 0;
          pixels[byteIndex + 2] = 0;
          pixels[byteIndex + 3] = 0;
        }
      }
    }
    else {
      pixels.fill(0);
    }

    this.#commitTextureReplaced(
      () => this.#buffer.writePixels(pixels)
    );
  }

  undo(): HistoryEntry | null {
    const entry = this.#runHistoryReplay(() => this.#history.undo());
    if (!entry) {
      return null;
    }

    for (const event of History.buildUndoReplayEvents(entry)) {
      this.#emitHook(event);
    }
    this.#onDrawEnd();

    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.#runHistoryReplay(() => this.#history.redo());
    if (!entry) {
      return null;
    }

    for (const event of History.buildRedoReplayEvents(entry)) {
      this.#emitHook(event);
    }
    this.#onDrawEnd();

    return entry;
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.#applyRemote(event);
    }
    finally {
      this.#isApplyingRemote = false;
    }

    if (
      event.action === "resized" ||
      event.action === "texture-replaced"
    ) {
      this.#onReset();
    }
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = []
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.#buffer.replacePixels(pixels, size);
      this.#uvMap.clear();
      for (const region of uvRegions) {
        this.#uvMap.restore(region);
      }
      this.#history.clear();
    }
    finally {
      this.#isApplyingRemote = false;
    }
    this.#onReset();
  }

  runLocalRestore<T>(
    fn: () => T
  ): T {
    const wasApplyingRemote = this.#isApplyingRemote;
    this.#isApplyingRemote = true;
    try {
      return fn();
    }
    finally {
      this.#isApplyingRemote = wasApplyingRemote;
    }
  }

  #applyRemote(
    event: PixelBufferHookEvent
  ): void {
    switch (event.action) {
      case "stroke":
        this.#applyStroke(
          event.metadata.color,
          event.metadata.positions
        );
        this.#onDrawEnd();
        break;

      case "resized":
        this.#buffer.resize(event.metadata.size);
        this.#history.clear();
        break;

      case "texture-replaced":
        this.#buffer.replacePixels(
          new Uint8ClampedArray(
            toUint8Array(event.metadata.pixels)
          ),
          event.metadata.size
        );
        this.#history.clear();
        break;

      case "global-fill": {
        const positions = Fill.matchAll(
          this.#buffer,
          event.metadata.fromColor
        );
        this.#applyStroke(
          event.metadata.toColor,
          positions
        );
        this.#onDrawEnd();
        break;
      }

      case "select-edit":
        applyColorGroups(
          this.#buffer,
          groupPositionsByColor(
            event.metadata.positions,
            event.metadata.colors
          )
        );
        this.#buffer.copyToMaster();
        this.#onDrawEnd();
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

      case "uv-region-rotated":
        this.#applyRemoteRotation(event.metadata);
        break;
    }
  }

  #commitTextureReplaced(
    apply: () => void
  ): void {
    const beforeSize = this.#buffer.size();
    const beforePixels = this.#history.enabled ?
      this.#buffer.pixels() :
      null;

    apply();
    const size = this.#buffer.size();

    if (beforePixels) {
      this.#recordHistory({
        action: "texture-replaced",
        beforeSize,
        beforePixels,
        afterSize: size,
        afterPixels: this.#buffer.pixels()
      });
    }

    this.#emitHook({
      action: "texture-replaced",
      metadata: {
        size,
        pixels: fromUint8Array(
          new Uint8Array(this.#buffer.pixels())
        )
      }
    });
  }

  #emitHook(
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

  #runHistoryReplay<T>(
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

  #applyStroke(
    color: RGBA8,
    positions: Vec2[]
  ): void {
    this.#buffer.drawPixels(positions, color);
    this.#buffer.copyToMaster();
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
    face: UVSlot | null,
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

  #handleUvRotated(
    region: UVRegion,
    previous: UVRegionData,
    face: UVSlot | null
  ): void {
    if (this.#isApplyingRemote) {
      return;
    }
    const data = region.toJSON();
    if (!this.#isReplayingHistory) {
      this.#history.push({
        action: "uv-rotate",
        id: region.id,
        face,
        before: previous,
        after: data
      });
    }
    this.#onBufferUpdated?.({
      action: "uv-region-rotated",
      metadata: face === null ?
        {
          id: region.id,
          face,
          region: data
        } :
        {
          id: region.id,
          face,
          geometry: region.geometryFor(face)
        }
    });
  }

  #applyRemoteRotation(
    rotation: UVRegionRotation
  ): void {
    if (rotation.face === null) {
      this.#uvMap.restoreRotation(rotation.region);

      return;
    }

    const region = this.#uvMap.get(rotation.id);
    if (region) {
      this.#uvMap.restoreRotation(
        region.withGeometry(rotation.face, rotation.geometry),
        rotation.face
      );
    }
  }
}
