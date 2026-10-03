// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";

export interface ArchiveBackend {
  readonly source: AssetSource;
  readonly kinds: AssetKindRegistry;
  readonly writer: AssetWriter;
  readonly catalog: CatalogProjection;

  flush(
    assetId?: string
  ): Promise<void>;
}
