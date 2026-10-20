// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import * as z from "zod/mini";

// Import Internal Dependencies
import { assetReferenceSchema } from "../../model/events/AssetEvents.schema.ts";

// CONSTANTS
export const ASSET_ARCHIVE_VERSION = 1;
export const ASSET_ARCHIVE_MANIFEST_PATH = "bundle.json";

export const assetArchiveEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  path: z.string()
});

export const assetArchiveManifestSchema = z.object({
  version: z.int(),
  root: z.optional(assetReferenceSchema),
  assets: z.array(assetArchiveEntrySchema),
  missing: z.optional(z.array(assetReferenceSchema))
});

export type AssetArchiveEntry = Readonly<
  Infer<typeof assetArchiveEntrySchema>
>;

export interface AssetArchiveManifest {
  readonly version: typeof ASSET_ARCHIVE_VERSION;
  readonly root?: AssetReferenceData;
  readonly assets: readonly AssetArchiveEntry[];
  readonly missing: readonly AssetReferenceData[];
}

export interface AssetArchiveAsset extends AssetArchiveEntry {
  readonly data: Uint8Array;
}

export interface AssetArchive {
  readonly root?: AssetReferenceData;
  readonly assets: readonly AssetArchiveAsset[];
  readonly missing: readonly AssetReferenceData[];
}
