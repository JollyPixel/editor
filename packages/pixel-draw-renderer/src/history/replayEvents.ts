// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  groupPositionsByColor,
  type HistoryEntry
} from "./HistoryStack.ts";
import type { PixelBufferHookEvent } from "../buffer/hooks.ts";

/**
 * Stamped with the entry's original timestamp (not "now") so the server's
 * per-pixel conflict resolver re-races the replay fairly against a peer's
 * edit made since. A stroke's before-state is usually heterogeneous, so
 * it's split into uniform-color groups — "stroke" only carries one color.
 */
export function buildUndoReplayEvents(
  entry: HistoryEntry
): PixelBufferHookEvent[] {
  const { timestamp } = entry;

  switch (entry.action) {
    case "stroke":
      return groupPositionsByColor(entry.positions, entry.beforeColors).map((group) => {
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
          metadata: { size: entry.beforeSize },
          originTimestamp: timestamp
        }
      ];

    case "texture-replaced":
      return [
        {
          action: "texture-replaced",
          metadata: {
            size: entry.beforeSize,
            pixels: fromUint8Array(new Uint8Array(entry.beforePixels))
          },
          originTimestamp: timestamp
        }
      ];

    default:
      return [];
  }
}

/** A stroke's after-state is always one uniform color, so no grouping is needed here (unlike undo). */
export function buildRedoReplayEvents(
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
          metadata: { size: entry.afterSize },
          originTimestamp: timestamp
        }
      ];

    case "texture-replaced":
      return [
        {
          action: "texture-replaced",
          metadata: {
            size: entry.afterSize,
            pixels: fromUint8Array(new Uint8Array(entry.afterPixels))
          },
          originTimestamp: timestamp
        }
      ];

    default:
      return [];
  }
}
