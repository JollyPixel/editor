// Import Third-party Dependencies
import type { MessageProtocol } from "@jolly-pixel/network";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  AssetCommandHeader,
  AssetLiveProtocol,
  AssetRelaySchemas
} from "./AssetLiveProtocol.ts";

export interface SnapshotPolicy {
  /**
   * Quiet period, in milliseconds, after the last event for an asset.
   * `0` snapshots as soon as the current task yields.
   * @default 2_000
   */
  delay?: number;
  /**
   * Upper bound, in milliseconds, between the first unsnapshotted event and
   * its snapshot. Bounds data loss while an asset is edited continuously.
   * @default 30_000
   */
  maxDelay?: number;
}

export interface AssetRoomBinding<TState = unknown> {
  readonly assetId: string;
  readonly kind: string;
  readonly roomId: string;
  readonly state: TState;
  readonly version?: () => number | undefined;
}

export interface AssetCommands<
  TState = unknown,
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> {
  readonly eventType: string;
  readonly protocol: MessageProtocol;
  /**
   * Ephemeral messages that `live().relay` handles outside arbitration and
   * the event log.
   */
  readonly relay?: AssetRelaySchemas<TRelay>;

  apply(
    state: TState,
    command: TCommand
  ): void;

  live?(
    binding: AssetRoomBinding<TState>
  ): AssetLiveProtocol<TCommand, TRelay>;
}

export type AssetConversion = (
  content: Uint8Array
) => Promise<Uint8Array>;

export interface AssetKindCompanion<TState = unknown> {
  readonly kind: string;

  link(
    state: TState,
    companion: AssetReferenceData
  ): void;
}

export interface AssetParts<
  TState = unknown,
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  /**
   * Part file extension, mapped to its media type.
   */
  readonly extension: Readonly<Record<string, string>>;

  touched(
    command: TCommand
  ): Iterable<string>;

  list(
    manifest: Uint8Array
  ): Iterable<string>;

  load(
    state: TState,
    partId: string,
    content: Uint8Array
  ): void;

  serialize(
    state: TState,
    partId: string
  ): Promise<Uint8Array>;
}

export interface AssetKindHandler<
  TState = unknown,
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> {
  readonly kind: string;
  readonly extensions: Readonly<Record<string, string>>;
  readonly match?: readonly string[];
  readonly snapshot?: SnapshotPolicy;
  readonly commands?: AssetCommands<TState, TCommand, TRelay>;
  readonly companions?: readonly AssetKindCompanion<TState>[];
  /**
   * Splits the content into a manifest, which `load` and `serialize` handle,
   * and parts stored, loaded and sent one by one.
   */
  readonly parts?: AssetParts<TState, TCommand>;
  /**
   * Turns another format, keyed by its extension, into this kind's content
   * when a catalog create names that extension in `from`.
   */
  readonly conversions?: Readonly<Record<string, AssetConversion>>;

  create(
    assetId: string
  ): TState;

  load(
    state: TState,
    content: Uint8Array
  ): void;

  clear(
    state: TState
  ): void;

  serialize(
    state: TState
  ): Promise<Uint8Array>;

  dependencies?(
    state: TState
  ): readonly AssetReferenceData[];

  rebind?(
    state: TState,
    idMap: ReadonlyMap<string, string>
  ): void;
}

export type AnyAssetKindHandler = AssetKindHandler<
  unknown,
  AssetCommandHeader,
  object
>;
