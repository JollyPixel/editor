// Import Internal Dependencies
import type { RGBA, Vec2 } from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

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

export type HistoryEntry =
  | HistoryStrokeEntry
  | HistoryResizedEntry
  | HistoryTextureReplacedEntry;

export type HistoryEntryInput =
  | Omit<HistoryStrokeEntry, "timestamp">
  | Omit<HistoryResizedEntry, "timestamp">
  | Omit<HistoryTextureReplacedEntry, "timestamp">;

export interface HistoryStackOptions {
  /** @default 10 */
  limit?: number;
}

export interface ColorGroup {
  color: RGBA;
  positions: Vec2[];
}

// CONSTANTS
const kDefaultLimit = 10;

/**
 * Buckets positions by identical color, so a heterogeneous per-pixel
 * restore can be applied as a few uniform-color drawPixels calls instead of
 * one call per pixel.
 */
export function groupPositionsByColor(
  positions: Vec2[],
  colors: RGBA[]
): ColorGroup[] {
  const groups = new Map<string, ColorGroup>();

  for (let i = 0; i < positions.length; i++) {
    const color = colors[i];
    const key = `${color.r},${color.g},${color.b},${color.a}`;

    let group = groups.get(key);
    if (!group) {
      group = { color, positions: [] };
      groups.set(key, group);
    }
    group.positions.push(positions[i]);
  }

  return [...groups.values()];
}

/**
 * Bounded undo/redo stack over DefaultPixelBuffer — no DOM or network
 * dependency, so it runs identically over a headless PixelBuffer or a
 * DOM-backed CanvasBuffer. Capturing before/after data is the caller's job;
 * this class only owns the stack and the replay against its buffer.
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
   * Stamps the entry with the current time — preserved across future
   * undo/redo replays for fair network conflict re-racing — and clears the
   * redo stack.
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

  /** Reverts the most recent entry, moving it to the redo stack. Null when there's nothing to undo. */
  undo(): HistoryEntry | null {
    const entry = this.#undoStack.pop();
    if (!entry) {
      return null;
    }

    this.#applyBefore(entry);
    this.#redoStack.push(entry);

    return entry;
  }

  /** Re-applies the most recently undone entry, moving it back to the undo stack. Null when there's nothing to redo. */
  redo(): HistoryEntry | null {
    const entry = this.#redoStack.pop();
    if (!entry) {
      return null;
    }

    this.#applyAfter(entry);
    this.#undoStack.push(entry);

    return entry;
  }

  /** Discards every recorded entry, e.g. when the buffer is replaced wholesale from outside the stack's knowledge. */
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

      case "resized":
      case "texture-replaced":
        this.#buffer.setPixels(entry.beforePixels, entry.beforeSize);
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

      case "resized":
      case "texture-replaced":
        this.#buffer.setPixels(entry.afterPixels, entry.afterSize);
        break;
    }
  }
}
