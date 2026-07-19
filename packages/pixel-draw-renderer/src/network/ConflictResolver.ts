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

    if (incoming.timestamp > existing.timestamp) {
      return "accept";
    }

    if (incoming.timestamp < existing.timestamp) {
      return "reject";
    }

    return incoming.clientId >= existing.clientId ? "accept" : "reject";
  }
}
