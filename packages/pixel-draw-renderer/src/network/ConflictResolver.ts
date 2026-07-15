// Import Internal Dependencies
import type { PixelNetworkCommandHeader } from "./types.ts";

export interface PixelConflictContext {
  incoming: PixelNetworkCommandHeader;
  /**
   * Header of the last accepted command at the same pixel, if any.
   * `undefined` means no prior command exists at that pixel → always accept.
   */
  existing: PixelNetworkCommandHeader | undefined;
}

/**
 * Determines whether an incoming command should be accepted or rejected
 * given the last known command header at the same pixel.
 *
 * Only the header is tracked (not the full stroke command) since a single
 * stroke can touch thousands of pixels — keeping a full command per pixel
 * would be wasteful.
 */
export interface PixelConflictResolver {
  resolve(ctx: PixelConflictContext): "accept" | "reject";
}

/**
 * Last-Write-Wins resolver: the command with the higher `timestamp` wins.
 * On a timestamp tie, the lexicographically greater `clientId` wins,
 * giving a deterministic total order without coordination.
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
