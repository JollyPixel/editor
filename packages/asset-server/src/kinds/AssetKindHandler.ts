// Import Third-party Dependencies
import type { MessageProtocol } from "@jolly-pixel/network";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetLiveProtocol } from "./AssetLiveProtocol.ts";

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
}

export interface AssetCommands<
  TState = unknown,
  TCommand = unknown
> {
  readonly eventType: string;
  readonly protocol: MessageProtocol;

  apply(
    state: TState,
    command: TCommand
  ): void;

  live?(
    binding: AssetRoomBinding<TState>
  ): AssetLiveProtocol<TCommand>;
}

/**
 * Folds an asset event stream and serializes its projected state.
 */
export interface AssetKindHandler<
  TState = unknown,
  TCommand = unknown
> {
  readonly kind: string;
  readonly extensions: Readonly<Record<string, string>>;
  readonly match?: readonly string[];
  readonly snapshot?: SnapshotPolicy;
  readonly commands?: AssetCommands<TState, TCommand>;

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
}
