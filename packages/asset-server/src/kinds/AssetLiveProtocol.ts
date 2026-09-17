// Import Third-party Dependencies
import type { JSONSchema } from "@jolly-pixel/network";

// CONSTANTS
export const ASSET_ROOM_DELETED = "deleted";
export const ASSET_ROOM_REJECTED = "rejected";

export interface AssetRoomMessage {
  readonly type: string;
  readonly data: unknown;
}

export interface AssetRoomDeletedMessage {
  readonly type: typeof ASSET_ROOM_DELETED;
}

export interface AssetRoomRejectedMessage {
  readonly type: typeof ASSET_ROOM_REJECTED;
  readonly reason: string;
}

export interface AssetArbitration<TCommand = unknown> {
  readonly command: TCommand;
  commit?(): void;
}

export interface AssetLiveProtocol<TCommand = unknown> {
  readonly snapshotSchema: JSONSchema;

  snapshot(): unknown;

  arbitrate(
    command: TCommand
  ): AssetArbitration<TCommand> | null;

  broadcast?(
    command: TCommand
  ): AssetRoomMessage;
}
