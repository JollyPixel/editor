// Import Internal Dependencies
import type { AnyExtension } from "../extension/Extension.ts";

export interface RoomResolution {
  extension: AnyExtension;
  /**
   * Flush hook called before extension disposal.
   */
  onEvict?: () => void | Promise<void>;
  /**
   * Milliseconds an empty room is kept before eviction.
   * A join inside that window cancels it.
   */
  graceMs?: number;
  /**
   * Caps every message right at "read"; joining and presence keep their
   * rights. The extension must declare an inbound message protocol.
   * @default false
   */
  readOnly?: boolean;
}

/**
 * Resolves unknown rooms on first join; null rejects the join.
 */
export type RoomResolver = (
  roomName: string
) => Promise<RoomResolution | null> | RoomResolution | null;
