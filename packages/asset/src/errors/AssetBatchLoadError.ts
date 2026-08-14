// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";

export interface AssetLoadFailure {
  readonly record: AssetRecord;
  readonly error: unknown;
}

/**
 * Collects every failure produced by one requested asset batch.
 */
export class AssetBatchLoadError extends Error {
  readonly failures: readonly AssetLoadFailure[];

  constructor(
    failures: Iterable<AssetLoadFailure>
  ) {
    const copiedFailures = Array.from(failures);
    super(`Failed to load ${copiedFailures.length} asset(s).`);
    this.name = "AssetBatchLoadError";
    this.failures = copiedFailures;
  }
}
