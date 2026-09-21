// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  isStatePath,
  safeAssetPath
} from "@jolly-pixel/asset-source/core";
import {
  Validator,
  type Infer
} from "ata-validator";
import {
  strFromU8,
  unzipSync,
  type Unzipped
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  ASSET_ARCHIVE_VERSION,
  DEFAULT_ARCHIVE_MAX_BYTES,
  DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
  assetArchiveManifestSchema,
  type AssetArchive,
  type AssetArchiveAsset
} from "./AssetArchive.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";

// CONSTANTS
const kManifestValidator = new Validator(
  assetArchiveManifestSchema,
  { useDefaults: false }
);
const kResourceForkDirectory = "__MACOSX/";
const kFinderMetadataName = ".DS_Store";

export interface ReadAssetArchiveOptions {
  maxEntryBytes?: number;
  maxBytes?: number;
}

export function readAssetArchive(
  bytes: Uint8Array,
  options: ReadAssetArchiveOptions = {}
): Result<AssetArchive, AssetArchiveError> {
  const unzipped = unzip(bytes, options);
  if (!unzipped.ok) {
    return unzipped;
  }

  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(unzipped.val)) {
    if (isStatePath(name)) {
      return Err(new AssetArchiveError(
        "reserved-path",
        `Archive entry "${name}" is reserved.`
      ));
    }
    if (!isOperatingSystemEntry(name)) {
      files.set(name, data);
    }
  }

  const manifestBytes = files.get(ASSET_ARCHIVE_MANIFEST_PATH);
  if (manifestBytes === undefined) {
    return Err(new AssetArchiveError(
      "manifest-missing",
      `Archive has no "${ASSET_ARCHIVE_MANIFEST_PATH}".`
    ));
  }
  files.delete(ASSET_ARCHIVE_MANIFEST_PATH);

  const manifest = parseManifest(manifestBytes);
  if (!manifest.ok) {
    return manifest;
  }

  const assets: AssetArchiveAsset[] = [];
  const ids = new Set<string>();
  for (const entry of manifest.val.assets) {
    const safe = safeAssetPath(entry.path);
    if (!safe.ok || safe.val !== entry.path) {
      return Err(new AssetArchiveError(
        "unsafe-path",
        `Asset path "${entry.path}" is not a safe workspace path.`,
        { assetId: entry.id }
      ));
    }
    if (isStatePath(entry.path)) {
      return Err(new AssetArchiveError(
        "reserved-path",
        `Asset path "${entry.path}" is reserved.`,
        { assetId: entry.id }
      ));
    }
    if (ids.has(entry.id)) {
      return Err(new AssetArchiveError(
        "duplicate",
        `Asset "${entry.id}" is listed twice.`,
        { assetId: entry.id }
      ));
    }

    const data = files.get(entry.path);
    if (data === undefined) {
      return Err(new AssetArchiveError(
        "missing-entry",
        `Archive has no entry "${entry.path}".`,
        { assetId: entry.id }
      ));
    }

    ids.add(entry.id);
    files.delete(entry.path);
    assets.push({
      id: entry.id,
      kind: entry.kind,
      path: entry.path,
      data
    });
  }

  const [unexpected] = files.keys();
  if (unexpected !== undefined) {
    return Err(new AssetArchiveError(
      "unexpected-entry",
      `Archive entry "${unexpected}" is not listed in the manifest.`
    ));
  }

  const { root } = manifest.val;
  if (root !== undefined && !ids.has(root.id)) {
    return Err(new AssetArchiveError(
      "manifest-invalid",
      `Root asset "${root.id}" is not part of the archive.`,
      { assetId: root.id }
    ));
  }

  return Ok({
    root,
    assets,
    missing: manifest.val.missing ?? []
  });
}

function unzip(
  bytes: Uint8Array,
  options: ReadAssetArchiveOptions
): Result<Unzipped, AssetArchiveError> {
  const {
    maxEntryBytes = DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
    maxBytes = DEFAULT_ARCHIVE_MAX_BYTES
  } = options;

  let total = 0;
  let oversized: AssetArchiveError | undefined;
  try {
    const unzipped = unzipSync(bytes, {
      filter: (file) => {
        total += file.originalSize;
        if (file.originalSize > maxEntryBytes) {
          oversized ??= new AssetArchiveError(
            "too-large",
            `Archive entry "${file.name}" exceeds ${maxEntryBytes} bytes.`
          );
        }
        else if (total > maxBytes) {
          oversized ??= new AssetArchiveError(
            "too-large",
            `Archive exceeds ${maxBytes} decoded bytes.`
          );
        }

        return oversized === undefined;
      }
    });

    return oversized === undefined ? Ok(unzipped) : Err(oversized);
  }
  catch (cause) {
    return Err(new AssetArchiveError(
      "corrupt",
      "Archive is not a readable ZIP file.",
      { cause }
    ));
  }
}

function parseManifest(
  bytes: Uint8Array
): Result<Infer<typeof assetArchiveManifestSchema>, AssetArchiveError> {
  let document: unknown;
  try {
    document = JSON.parse(strFromU8(bytes));
  }
  catch (cause) {
    return Err(new AssetArchiveError(
      "manifest-invalid",
      "Archive manifest is not valid JSON.",
      { cause }
    ));
  }

  const result = kManifestValidator.validate(document);
  if (!result.valid) {
    return Err(new AssetArchiveError(
      "manifest-invalid",
      "Archive manifest does not match the expected shape."
    ));
  }
  if (result.data.version !== ASSET_ARCHIVE_VERSION) {
    return Err(new AssetArchiveError(
      "unsupported-version",
      `Archive version ${result.data.version} is not supported.`
    ));
  }

  return Ok(result.data);
}

function isOperatingSystemEntry(
  name: string
): boolean {
  return name.endsWith("/") ||
    name.startsWith(kResourceForkDirectory) ||
    name === kFinderMetadataName ||
    name.endsWith(`/${kFinderMetadataName}`);
}
