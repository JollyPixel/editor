// Import Third-party Dependencies
import type {
  Schema,
  NetworkCommandHeader,
  RoomBroadcast
} from "@jolly-pixel/network";
import type * as z from "zod/mini";

export type AssetCommandHeader = Partial<NetworkCommandHeader>;

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
  /**
   * Deflates `parts` messages on sockets that negotiated compression.
   * @default false
   */
  readonly compress?: boolean;

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
  /**
   * `true` when authors rewrite their own copy the way `arbitrate` rewrites
   * their command, so the room sends them no correction or snapshot.
   * @default false
   */
  readonly authorRebases?: boolean;
  /**
   * Deflates the bytes of `snapshot()` on sockets that negotiated
   * compression. `encodeSnapshot()` output goes out as it is.
   * @default false
   */
  readonly compressSnapshot?: boolean;
  /**
   * Deflates broadcast commands and catch-ups on sockets that negotiated
   * compression, for kinds whose commands carry raw bytes such as heights.
   * @default false
   */
  readonly compressCommands?: boolean;

  snapshot(): unknown;

  reloaded?(): void;

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
