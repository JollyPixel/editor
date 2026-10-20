// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  type AssetArchive,
  type AssetArchiveAsset
} from "./AssetArchive.ts";
import {
  DEFAULT_ARCHIVE_MAX_BYTES,
  DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
  type ArchiveLimits
} from "./ArchiveLimits.ts";
import { ArchiveFiles } from "./format/ArchiveFiles.ts";
import { parseArchiveManifest } from "./format/ArchiveManifest.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";

export function readAssetArchive(
  bytes: Uint8Array,
  limits: ArchiveLimits = {}
): Result<AssetArchive, AssetArchiveError> {
  const unzipped = ArchiveFiles.unzip(bytes, {
    maxEntryBytes: limits.maxEntryBytes ?? DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
    maxBytes: limits.maxBytes ?? DEFAULT_ARCHIVE_MAX_BYTES
  });
  if (!unzipped.ok) {
    return unzipped;
  }

  const files = unzipped.val;
  const manifestBytes = files.take(ASSET_ARCHIVE_MANIFEST_PATH);
  if (manifestBytes === undefined) {
    const error = new AssetArchiveError(
      "manifest-missing",
      `Archive has no "${ASSET_ARCHIVE_MANIFEST_PATH}".`
    );

    return Err(error);
  }

  const manifest = parseArchiveManifest(manifestBytes);
  if (!manifest.ok) {
    return manifest;
  }

  const assets: AssetArchiveAsset[] = [];
  for (const entry of manifest.val.assets) {
    const data = files.take(entry.path);
    if (data === undefined) {
      const error = new AssetArchiveError(
        "missing-entry",
        `Archive has no entry "${entry.path}".`,
        { assetId: entry.id }
      );

      return Err(error);
    }
    assets.push({
      id: entry.id,
      kind: entry.kind,
      path: entry.path,
      data
    });
  }

  const unexpected = files.firstUntaken();
  if (unexpected !== undefined) {
    const error = new AssetArchiveError(
      "unexpected-entry",
      `Archive entry "${unexpected}" is not listed in the manifest.`
    );

    return Err(error);
  }

  return Ok({
    root: manifest.val.root,
    assets,
    missing: manifest.val.missing
  });
}
