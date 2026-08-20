// Import Internal Dependencies
import type { Extension } from "../extension/Extension.ts";

export interface RoomResolution {
  extension: Extension;
  /**
   * Flush hook called before extension disposal.
   */
  onEvict?: () => void | Promise<void>;
  /**
   * Milliseconds an empty room is kept before eviction.
   * A join inside that window cancels it.
   */
  graceMs?: number;
}

/**
 * Resolves unknown rooms on first join; null rejects the join.
 */
export type RoomResolver = (
  roomName: string
) => Promise<RoomResolution | null> | RoomResolution | null;
