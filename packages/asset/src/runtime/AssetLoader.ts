// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";

export interface AssetLoadContext {
  signal?: AbortSignal;
}

export interface AssetLoader<
  TValue = unknown
> {
  load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue>;
}
