// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  DefaultPixelBuffer
} from "../buffer/types.ts";
import {
  groupPositionsByColor
} from "./utils.ts";

export interface HistoryStrokeEntry {
  action: "stroke";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColor: RGBA;
}

export interface HistoryResizedEntry {
  action: "resized";
  timestamp: number;
  beforeSize: Vec2;
  beforePixels: Uint8ClampedArray;
  afterSize: Vec2;
  afterPixels: Uint8ClampedArray;
}

export interface HistoryTextureReplacedEntry {
  action: "texture-replaced";
  timestamp: number;
  beforeSize: Vec2;
  beforePixels: Uint8ClampedArray;
  afterSize: Vec2;
  afterPixels: Uint8ClampedArray;
}

/**
 * Stores pixels and selection state before and after a selection edit.
 */
export interface HistorySelectEditEntry {
  action: "select-edit";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export type HistoryEntry =
  | HistoryStrokeEntry
  | HistoryResizedEntry
  | HistoryTextureReplacedEntry
  | HistorySelectEditEntry;

export type HistoryEntryInput =
  | Omit<HistoryStrokeEntry, "timestamp">
  | Omit<HistoryResizedEntry, "timestamp">
  | Omit<HistoryTextureReplacedEntry, "timestamp">
  | Omit<HistorySelectEditEntry, "timestamp">;

export interface HistoryStackOptions {
  /**
   * @default 10
   */
  limit?: number;
}

// CONSTANTS
const kDefaultLimit = 10;

/**
 * Replays a bounded undo/redo stack against a pixel buffer.
 */
export class HistoryStack {
  #buffer: DefaultPixelBuffer;
  #limit: number;
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];

  constructor(
    buffer: DefaultPixelBuffer,
    options: HistoryStackOptions = {}
  ) {
    this.#buffer = buffer;
    this.#limit = options.limit ?? kDefaultLimit;
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /**
   * Records an entry with its creation timestamp.
   */
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
      case "stroke":
        for (const group of groupPositionsByColor(entry.positions, entry.beforeColors)) {
          this.#buffer.drawPixels(group.positions, group.color);
        }
        this.#buffer.copyToMaster();
        break;

      case "select-edit":
        for (const group of groupPositionsByColor(entry.positions, entry.beforeColors)) {
          this.#buffer.drawPixels(group.positions, group.color);
        }
        this.#buffer.copyToMaster();
        break;

      case "resized":
      case "texture-replaced":
        this.#buffer.replacePixels(entry.beforePixels, entry.beforeSize);
        break;
    }
  }

  #applyAfter(
    entry: HistoryEntry
  ): void {
    switch (entry.action) {
      case "stroke":
        this.#buffer.drawPixels(entry.positions, entry.afterColor);
        this.#buffer.copyToMaster();
        break;

      case "select-edit":
        for (const group of groupPositionsByColor(entry.positions, entry.afterColors)) {
          this.#buffer.drawPixels(group.positions, group.color);
        }
        this.#buffer.copyToMaster();
        break;

      case "resized":
      case "texture-replaced":
        this.#buffer.replacePixels(entry.afterPixels, entry.afterSize);
        break;
    }
  }
}
