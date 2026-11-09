// Import Internal Dependencies
import type { AssetCatalog } from "../AssetCatalog.ts";
import type { AssetRecord } from "../AssetRecord.ts";
import type { AssetReference } from "../AssetReference.ts";

export interface AssetLoadOptions {
  signal?: AbortSignal;
}

export interface AssetDependencies {
  readonly catalog: AssetCatalog;

  load<TValue>(
    reference: AssetReference<TValue>
  ): Promise<TValue>;
}

export interface AssetLoadContext extends AssetLoadOptions {
  readonly assets: AssetDependencies;
}

export interface AssetLoader<
  TValue = unknown
> {
  load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue>;
}
