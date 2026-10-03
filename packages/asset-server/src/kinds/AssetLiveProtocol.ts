// Import Third-party Dependencies
import type {
  JSONSchema,
  NetworkCommandHeader
} from "@jolly-pixel/network";

// CONSTANTS
export const ASSET_ROOM_DELETED = "deleted";
export const ASSET_ROOM_REJECTED = "rejected";

export type AssetCommandHeader = Partial<NetworkCommandHeader>;

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

export type AssetBroadcast<TCommand> =
  | { readonly type: "command"; readonly data: TCommand; }
  | { readonly type: "snapshot"; readonly data: unknown; };

export interface AssetArbitration<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  readonly command: TCommand;
  commit?(version?: number): void;
}

export interface AssetLiveProtocol<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  readonly snapshotSchema: JSONSchema;

  snapshot(): unknown;

  encodeSnapshot?(): Promise<unknown>;

  arbitrate(
    command: TCommand
  ): AssetArbitration<TCommand> | null;

  broadcast?(
    command: TCommand
  ): AssetBroadcast<TCommand>;

  correct?(
    command: TCommand,
    admitted: TCommand | null
  ): TCommand | null;

  restore?(
    command: TCommand,
    version: number
  ): void;
}
