// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  isStatePath,
  safeAssetPath
} from "@jolly-pixel/asset-source/core";
import { Validator } from "ata-validator";
import {
  strFromU8,
  strToU8
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_VERSION,
  assetArchiveManifestSchema,
  type AssetArchiveEntry,
  type AssetArchiveManifest
} from "../AssetArchive.ts";
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";

// CONSTANTS
const kManifestValidator = new Validator(
  assetArchiveManifestSchema,
  { useDefaults: false }
);

export function archiveEntryOf(
  record: AssetRecord
): AssetArchiveEntry {
  return {
    id: record.id.value,
    kind: record.kind,
    path: record.source
  };
}

export function encodeArchiveManifest(
  manifest: AssetArchiveManifest
): Uint8Array {
  return strToU8(JSON.stringify(manifest, null, 2));
}

export function parseArchiveManifest(
  bytes: Uint8Array
): Result<AssetArchiveManifest, AssetArchiveError> {
  let document: unknown;
  try {
    document = JSON.parse(strFromU8(bytes));
  }
  catch (cause) {
    const error = new AssetArchiveError(
      "manifest-invalid",
      "Archive manifest is not valid JSON.",
      { cause }
    );

    return Err(error);
  }

  const result = kManifestValidator.validate(document);
  if (!result.valid) {
    const error = new AssetArchiveError(
      "manifest-invalid",
      "Archive manifest does not match the expected shape."
    );

    return Err(error);
  }
  if (result.data.version !== ASSET_ARCHIVE_VERSION) {
    const error = new AssetArchiveError(
      "unsupported-version",
      `Archive version ${result.data.version} is not supported.`
    );

    return Err(error);
  }

  const { root, assets, missing = [] } = result.data;
  const ids = new Set<string>();
  for (const entry of assets) {
    const checked = checkEntry(entry, ids);
    if (!checked.ok) {
      return checked;
    }
    ids.add(entry.id);
  }
  if (root !== undefined && !ids.has(root.id)) {
    const error = new AssetArchiveError(
      "manifest-invalid",
      `Root asset "${root.id}" is not part of the archive.`,
      { assetId: root.id }
    );

    return Err(error);
  }

  return Ok({
    version: ASSET_ARCHIVE_VERSION,
    root,
    assets,
    missing
  });
}

function checkEntry(
  entry: AssetArchiveEntry,
  ids: ReadonlySet<string>
): Result<void, AssetArchiveError> {
  const safe = safeAssetPath(entry.path);
  if (!safe.ok || safe.val !== entry.path) {
    const error = new AssetArchiveError(
      "unsafe-path",
      `Asset path "${entry.path}" is not a safe workspace path.`,
      { assetId: entry.id }
    );

    return Err(error);
  }
  if (isStatePath(entry.path)) {
    const error = new AssetArchiveError(
      "reserved-path",
      `Asset path "${entry.path}" is reserved.`,
      { assetId: entry.id }
    );

    return Err(error);
  }
  if (ids.has(entry.id)) {
    const error = new AssetArchiveError(
      "duplicate",
      `Asset "${entry.id}" is listed twice.`,
      { assetId: entry.id }
    );

    return Err(error);
  }

  return Ok(undefined);
}
