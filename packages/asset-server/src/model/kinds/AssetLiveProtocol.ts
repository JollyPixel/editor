// Import Third-party Dependencies
import type {
  Schema,
  NetworkCommandHeader,
  RoomBroadcast
} from "@jolly-pixel/network";
import type * as z from "zod/mini";

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

export interface AssetRelaySchemas<
  TInbound extends object = object
> {
  /**
   * Client messages the relay receives. Each one carries a literal tag on the
   * command protocol's discriminator that no command uses.
   */
  readonly inbound: readonly z.core.$ZodType<TInbound>[];
  /**
   * Messages the relay sends to clients, tagged by a literal `type`.
   */
  readonly outbound: readonly Schema[];
}

export interface AssetRelay<
  TInbound extends object = object
> {
  receive(
    clientId: string,
    message: TInbound,
    room: RoomBroadcast
  ): void;

  leave?(
    clientId: string
  ): void;
}

export interface AssetLiveProtocol<
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> {
  readonly snapshotSchema: Schema;

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

  readonly relay?: AssetRelay<TRelay>;
}
