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
export const ASSET_ROOM_PARTS = "parts";
export const ASSET_ROOM_SUBSCRIBE_PARTS = "subscribe-parts";
export const ASSET_ROOM_UNSUBSCRIBE_PARTS = "unsubscribe-parts";
export const ASSET_ROOM_MAX_PARTS_PER_MESSAGE = 1_024;

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

export interface AssetRoomPartsMessage<TPart = unknown> {
  readonly type: typeof ASSET_ROOM_PARTS;
  readonly version: number;
  /**
   * `null` for a part the manifest does not list.
   */
  readonly parts: Readonly<Record<string, TPart | null>>;
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

export interface AssetLiveParts<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  /**
   * Wire form of one part in a `parts` message.
   */
  readonly schema: Schema;

  part(
    partId: string
  ): unknown;

  outside?(
    command: TCommand
  ): TCommand | null;
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

  /**
   * Part subscriptions, for a kind that declares parts.
   */
  readonly parts?: AssetLiveParts<TCommand>;
}
