// CONSTANTS
export const DEFAULT_SNAPSHOT_POLICY: Readonly<Required<SnapshotPolicy>> = Object.freeze({
  delay: 2_000,
  maxDelay: 30_000
});

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
