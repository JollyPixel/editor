// Import Internal Dependencies
import type {
  DefaultPixelBuffer
} from "../buffer/types.ts";
import type { UVMap } from "../uv/UVMap.ts";
import type {
  HistoryEntry,
  HistoryEntryInput
} from "./HistoryStack.types.ts";
import {
  groupPositionsByColor
} from "./utils.ts";

// CONSTANTS
const kDefaultLimit = 10;

export interface HistoryStackOptions {
  /**
   * @default 10
   */
  limit?: number;
}

export class HistoryStack {
  #buffer: DefaultPixelBuffer;
  #uvMap: UVMap;
  #limit: number;
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];

  constructor(
    buffer: DefaultPixelBuffer,
    uvMap: UVMap,
    options: HistoryStackOptions = {}
  ) {
    this.#buffer = buffer;
    this.#uvMap = uvMap;
    this.#limit = options.limit ?? kDefaultLimit;
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  push(
    entry: HistoryEntryInput
  ): void {
    this.#undoStack.push({
      ...entry,
      timestamp: Date.now()
    });

    if (this.#undoStack.length > this.#limit) {
      this.#undoStack.shift();
    }
    this.#redoStack = [];
  }

  undo(): HistoryEntry | null {
    const entry = this.#undoStack.pop();
    if (!entry) {
      return null;
    }

    this.#applyBefore(entry);
    this.#redoStack.push(entry);

    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.#redoStack.pop();
    if (!entry) {
      return null;
    }

    this.#applyAfter(entry);
    this.#undoStack.push(entry);

    return entry;
  }

  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }

  #applyBefore(
    entry: HistoryEntry
  ): void {
    switch (entry.action) {
      case "stroke": {
        const groupedColors = groupPositionsByColor(
          entry.positions,
          entry.beforeColors
        );
        for (const group of groupedColors) {
          this.#buffer.drawPixels(
            group.positions,
            group.color
          );
        }

        this.#buffer.copyToMaster();
        break;
      }

      case "select-edit": {
        const groupedColors = groupPositionsByColor(
          entry.positions,
          entry.beforeColors
        );
        for (const group of groupedColors) {
          this.#buffer.drawPixels(
            group.positions,
            group.color
          );
        }

        this.#buffer.copyToMaster();
        break;
      }

      case "resized":
      case "texture-replaced":
        this.#buffer.replacePixels(
          entry.beforePixels,
          entry.beforeSize
        );
        break;

      case "uv-create":
        this.#uvMap.delete(entry.region.id);
        break;

      case "uv-delete":
        this.#uvMap.restore(entry.region);
        break;

      case "uv-move":
        this.#uvMap.move(
          entry.id,
          entry.oldRect,
          entry.face ?? undefined
        );
        break;

      case "uv-state":
        this.#uvMap.restoreState(entry.before);
        break;
    }
  }

  #applyAfter(
    entry: HistoryEntry
  ): void {
    switch (entry.action) {
      case "stroke":
        this.#buffer.drawPixels(
          entry.positions,
          entry.afterColor
        );
        this.#buffer.copyToMaster();
        break;

      case "select-edit": {
        const groupedColors = groupPositionsByColor(
          entry.positions,
          entry.afterColors
        );
        for (const group of groupedColors) {
          this.#buffer.drawPixels(
            group.positions,
            group.color
          );
        }

        this.#buffer.copyToMaster();
        break;
      }

      case "resized":
      case "texture-replaced":
        this.#buffer.replacePixels(
          entry.afterPixels,
          entry.afterSize
        );
        break;

      case "uv-create":
        this.#uvMap.restore(entry.region);
        break;

      case "uv-delete":
        this.#uvMap.delete(entry.region.id);
        break;

      case "uv-move":
        this.#uvMap.move(
          entry.id,
          entry.newRect,
          entry.face ?? undefined
        );
        break;

      case "uv-state":
        this.#uvMap.restoreState(entry.after);
        break;
    }
  }
}
