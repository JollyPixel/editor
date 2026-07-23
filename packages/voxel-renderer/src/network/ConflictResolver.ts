// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

export interface VoxelConflictContext {
  incoming: VoxelNetworkCommand;
  existing: VoxelNetworkCommand | undefined;
}

export interface VoxelConflictResolver {
  resolve(
    ctx: VoxelConflictContext
  ): "accept" | "reject";
}

/**
 * Last-Write-Wins resolver: the command with the higher `timestamp` wins.
 * On a timestamp tie, the lexicographically greater `clientId` wins,
 * giving a deterministic total order without coordination.
 */
export class LastWriteWinsResolver implements VoxelConflictResolver {
  resolve(
    ctx: VoxelConflictContext
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

    // Tie-break: lexicographically greater clientId wins.
    return incoming.clientId >= existing.clientId ? "accept" : "reject";
  }
}
