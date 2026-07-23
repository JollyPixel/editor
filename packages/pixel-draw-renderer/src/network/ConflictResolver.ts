// Import Internal Dependencies
import type {
  PixelNetworkCommandHeader
} from "./types.ts";

export interface PixelConflictContext {
  incoming: PixelNetworkCommandHeader;
  /**
   * Last accepted command at the pixel.
   */
  existing: PixelNetworkCommandHeader | undefined;
}

export interface PixelConflictResolver {
  resolve(
    ctx: PixelConflictContext
  ): "accept" | "reject";
}

/**
 * Resolves conflicts by timestamp, then client ID.
 */
export class LastWriteWinsResolver implements PixelConflictResolver {
  resolve(
    ctx: PixelConflictContext
  ): "accept" | "reject" {
    const { incoming, existing } = ctx;

    if (!existing) {
      return "accept";
    }

    // A client's own commands arrive in send order (one WebSocket
    // connection, TCP-ordered) regardless of the wall-clock timestamp they
    // carry. This matters for undo/redo replay, which deliberately stamps
    // its command with the original edit's (now historical) timestamp
    // instead of "now" — see `PixelBufferHookEvent.originTimestamp`. Undoing
    // two overlapping edits touches the shared pixel with a newer-timestamped
    // replay first (undo is LIFO) and an older-timestamped one second; a
    // plain timestamp comparison would reject the second as "stale" even
    // though it's the same client legitimately continuing to unwind its own
    // history. Only a genuinely different client's edit needs to win by
    // timestamp.
    if (incoming.clientId === existing.clientId) {
      return "accept";
    }

    if (incoming.timestamp > existing.timestamp) {
      return "accept";
    }

    if (incoming.timestamp < existing.timestamp) {
      return "reject";
    }

    return incoming.clientId >= existing.clientId ? "accept" : "reject";
  }
}
