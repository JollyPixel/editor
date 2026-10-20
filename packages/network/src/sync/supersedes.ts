// Import Internal Dependencies
import type { NetworkCommandHeader } from "./types.ts";

export type ConflictRecord = NetworkCommandHeader & {
  version?: number;
};

export function supersedes(
  incoming: NetworkCommandHeader,
  existing: ConflictRecord | undefined
): boolean {
  if (
    existing === undefined ||
    incoming.clientId === existing.clientId
  ) {
    return true;
  }

  if (existing.version !== undefined) {
    return incoming.basis === undefined || incoming.basis >= existing.version;
  }

  if (incoming.timestamp !== existing.timestamp) {
    return incoming.timestamp > existing.timestamp;
  }

  return incoming.clientId >= existing.clientId;
}
