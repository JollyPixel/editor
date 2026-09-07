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
  readonly match: readonly string[];
  readonly snapshot?: SnapshotPolicy;
  readonly contentTypes?: Readonly<Record<string, string>>;

  create(
    assetId: string
  ): TState;

  apply(
    state: TState,
    event: EventStore.Event
  ): void;

  serialize(
    state: TState
  ): Promise<Uint8Array>;

  createExtension?(
    binding: AssetRoomBinding<TState>
  ): Extension;
}
