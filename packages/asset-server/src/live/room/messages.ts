// CONSTANTS
export const ASSET_ROOM_DELETED = "deleted";
export const ASSET_ROOM_REJECTED = "rejected";
export const ASSET_ROOM_PARTS = "parts";
export const ASSET_ROOM_SUBSCRIBE_PARTS = "subscribe-parts";
export const ASSET_ROOM_UNSUBSCRIBE_PARTS = "unsubscribe-parts";
export const ASSET_ROOM_MAX_PARTS_PER_MESSAGE = 1_024;
export const ASSET_ROOM_INLINE_SNAPSHOT = "inline-snapshot";

export interface AssetRoomDeletedMessage {
  readonly type: typeof ASSET_ROOM_DELETED;
}

export interface AssetRoomRejectedMessage {
  readonly type: typeof ASSET_ROOM_REJECTED;
  readonly reason: string;
}

export type AssetRoomNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export interface AssetRoomPartsMessage<TPart = unknown> {
  readonly type: typeof ASSET_ROOM_PARTS;
  readonly version: number;
  /**
   * `null` for a part the manifest does not list.
   */
  readonly parts: Readonly<Record<string, TPart | null>>;
}

export interface AssetRoomInlineSnapshotMessage<TSnapshot = unknown> {
  readonly type: typeof ASSET_ROOM_INLINE_SNAPSHOT;
  readonly data: TSnapshot;
  readonly version?: number;
}

export interface AssetPartsRequest {
  readonly action:
    | typeof ASSET_ROOM_SUBSCRIBE_PARTS
    | typeof ASSET_ROOM_UNSUBSCRIBE_PARTS;
  readonly parts: readonly string[];
}

export function partRequests(
  action: AssetPartsRequest["action"],
  partIds: readonly string[]
): AssetPartsRequest[] {
  const requests: AssetPartsRequest[] = [];
  for (let index = 0; index < partIds.length; index += ASSET_ROOM_MAX_PARTS_PER_MESSAGE) {
    requests.push({
      action,
      parts: partIds.slice(index, index + ASSET_ROOM_MAX_PARTS_PER_MESSAGE)
    });
  }

  return requests;
}
