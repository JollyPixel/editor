// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

export interface StudioCatalog {
  record(
    assetId: string
  ): AssetRecordData | undefined;
  on(
    event: "change",
    listener: () => void
  ): unknown;
  off(
    event: "change",
    listener: () => void
  ): unknown;
}
