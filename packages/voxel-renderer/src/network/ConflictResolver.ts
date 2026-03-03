// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";

export interface ConflictContext {
  /** The incoming command to evaluate. */
  incoming: VoxelNetworkCommand;
  /**
   * The last accepted command at the same position, if any.
   * `undefined` means no prior command exists → always accept.
   */
  existing: VoxelNetworkCommand | undefined;
}

/**
 * Determines whether an incoming command should be accepted or rejected
 * given the last known command at the same world position.
 */
export interface ConflictResolver {
  resolve(ctx: ConflictContext): "accept" | "reject";
}

/**
 * Last-Write-Wins resolver: the command with the higher `timestamp` wins.
 * On a timestamp tie, the lexicographically greater `clientId` wins,
 * giving a deterministic total order without coordination.
 */
export class LastWriteWinsResolver implements ConflictResolver {
  resolve({ incoming, existing }: ConflictContext): "accept" | "reject" {
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
