// Import Third-party Dependencies
import { defineSchema } from "@jolly-pixel/network";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { Infer } from "ata-validator";

// Import Internal Dependencies
import type { AssetBackend } from "../createAssetBackend.ts";
import { assetReferenceSchema } from "../events/AssetEvents.schema.ts";

// CONSTANTS
export const ASSET_ARCHIVE_VERSION = 1;
export const ASSET_ARCHIVE_MANIFEST_PATH = "bundle.json";

export const assetArchiveEntrySchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string" },
    path: { type: "string" }
  },
  required: [
    "id",
    "kind",
    "path"
  ]
});

export const assetArchiveManifestSchema = defineSchema({
  type: "object",
  properties: {
    version: { type: "integer" },
    root: assetReferenceSchema,
    assets: {
      type: "array",
      items: assetArchiveEntrySchema
    },
    missing: {
      type: "array",
      items: assetReferenceSchema
    }
  },
  required: [
    "version",
    "assets"
  ]
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

export type ArchiveBackend = Pick<
  AssetBackend,
  "source" | "kinds" | "writer" | "catalog" | "flush"
>;
