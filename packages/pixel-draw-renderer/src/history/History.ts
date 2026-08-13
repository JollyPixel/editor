// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  HistoryStack
} from "./HistoryStack.ts";
import type {
  HistoryEntry,
  HistoryEntryInput
} from "./HistoryStack.types.ts";
import {
  groupPositionsByColor
} from "../buffer/colorGroups.ts";
import type {
  DefaultPixelBuffer
} from "../buffer/types.ts";
import type {
  PixelBufferHookEvent
} from "../buffer/hooks.ts";
import type { UVMap } from "../uv/UVMap.ts";

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryOptions {
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * @default 10
   */
  limit?: number;
  onChange?: (state: HistoryState) => void;
}

export class History {
  static buildUndoReplayEvents(
    entry: HistoryEntry
  ): PixelBufferHookEvent[] {
    const { timestamp } = entry;

    switch (entry.action) {
      case "stroke":
        return groupPositionsByColor(
          entry.positions,
          entry.beforeColors
        ).map((group) => {
          return {
            action: "stroke",
            metadata: {
              color: group.color,
              positions: group.positions
            },
            originTimestamp: timestamp
          };
        });

      case "resized":
        return [
          {
            action: "resized",
            metadata: {
              size: entry.beforeSize
            },
            originTimestamp: timestamp
          }
        ];

      case "texture-replaced":
        return [
          {
            action: "texture-replaced",
            metadata: {
              size: entry.beforeSize,
              pixels: fromUint8Array(
                new Uint8Array(entry.beforePixels)
              )
            },
            originTimestamp: timestamp
          }
        ];

      case "select-edit":
        return [
          {
            action: "select-edit",
            metadata: {
              positions: entry.positions,
              colors: entry.beforeColors
            },
            originTimestamp: timestamp
          }
        ];

      default:
        return [];
    }
  }

  static buildRedoReplayEvents(
    entry: HistoryEntry
  ): PixelBufferHookEvent[] {
    const { timestamp } = entry;

    switch (entry.action) {
      case "stroke":
        return [
          {
            action: "stroke",
            metadata: {
              color: entry.afterColor,
              positions: entry.positions
            },
            originTimestamp: timestamp
          }
        ];

      case "resized":
        return [
          {
            action: "resized",
            metadata: {
              size: entry.afterSize
            },
            originTimestamp: timestamp
          }
        ];

      case "texture-replaced":
        return [
          {
            action: "texture-replaced",
            metadata: {
              size: entry.afterSize,
              pixels: fromUint8Array(
                new Uint8Array(entry.afterPixels)
              )
            },
            originTimestamp: timestamp
          }
        ];

      case "select-edit":
        return [
          {
            action: "select-edit",
            metadata: {
              positions: entry.positions,
              colors: entry.afterColors
            },
            originTimestamp: timestamp
          }
        ];

      default:
        return [];
    }
  }

  #stack?: HistoryStack;
  #onChange?: (state: HistoryState) => void;

  constructor(
    buffer: DefaultPixelBuffer,
    uvMap: UVMap,
    options: HistoryOptions = {}
  ) {
    if (options.enabled) {
      this.#stack = new HistoryStack(buffer, uvMap, {
        limit: options.limit
      });
    }
    this.#onChange = options.onChange;
  }

  get enabled(): boolean {
    return this.#stack !== undefined;
  }

  get canUndo(): boolean {
    return this.#stack?.canUndo ?? false;
  }

  get canRedo(): boolean {
    return this.#stack?.canRedo ?? false;
  }

  push(
    entry: HistoryEntryInput
  ): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.push(entry);
    this.#notify();
  }

  undo(): HistoryEntry | null {
    const entry = this.#stack?.undo() ?? null;
    if (entry) {
      this.#notify();
    }

    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.#stack?.redo() ?? null;
    if (entry) {
      this.#notify();
    }

    return entry;
  }

  clear(): void {
    if (!this.#stack) {
      return;
    }

    this.#stack.clear();
    this.#notify();
  }

  #notify(): void {
    this.#onChange?.({
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
  }
}
