// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { Extension } from "@jolly-pixel/network";

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
  /**
   * Room name clients joined. The Extension must expose it as its `id`.
   */
  readonly roomId: string;
  /**
   * State-store-owned live state, mutated only through appended events.
   */
  readonly state: TState;
}

/**
 * Folds an asset event stream and serializes its projected state.
 */
export interface AssetKindHandler<TState = unknown> {
  readonly kind: string;
  /**
   * Globs claiming paths for this kind, matched against root-relative POSIX
   * paths.
   */
  readonly match: readonly string[];
  readonly snapshot?: SnapshotPolicy;

  create(
    assetId: string
  ): TState;

  /**
   * Applies one event to the state. Receives every event on the asset's
   * stream, lifecycle and domain alike.
   */
  apply(
    state: TState,
    event: EventStore.Event
  ): void;

  serialize(
    state: TState
  ): Promise<Uint8Array>;

  /**
   * Builds the room Extension for one open asset. Kinds with no live editing
   * omit it and get no dynamic room.
   */
  createExtension?(
    binding: AssetRoomBinding<TState>
  ): Extension;
}
