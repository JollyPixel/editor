// Import Third-party Dependencies
import type {
  AssetRecord,
  AssetReferenceData
} from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  ASSET_ARCHIVE_VERSION,
  type AssetArchiveEntry
} from "./AssetArchive.ts";
import type { ArchiveBackend } from "./ArchiveBackend.ts";
import type { AssetImportError } from "./import/AssetImport.ts";
import {
  archiveEntryOf,
  encodeArchiveManifest
} from "./format/ArchiveManifest.ts";
import { readableAsset } from "./readableAsset.ts";
import { UnknownAssetError } from "../writer/errors/UnknownAssetError.ts";

export type AssetExportError = AssetImportError | UnknownAssetError;

export interface ExportAssetArchiveOptions {
  root?: string;
}

export async function exportAssetArchive(
  backend: ArchiveBackend,
  options: ExportAssetArchiveOptions = {}
): Promise<Result<Uint8Array, AssetExportError>> {
  const { catalog } = backend;
  const root = await flushRoot(backend, options.root);
  if (!root.ok) {
    return root;
  }

  const starts = root.val === undefined ?
    Array.from(catalog.catalog, referenceOf) :
    [root.val];

  const assets: AssetArchiveEntry[] = [];
  const missing: AssetReferenceData[] = [];
  const files: Zippable = {};
  for (const reference of catalog.dependencies.dependenciesFirst(starts)) {
    const record = catalog.record(reference.id);
    if (record === undefined) {
      missing.push(reference);

      continue;
    }

    const entry = archiveEntryOf(record);
    const data = await backend.source.read(entry.path);
    const readable = readableAsset(backend.kinds, {
      ...entry,
      data
    });
    if (!readable.ok) {
      return readable;
    }

    assets.push(entry);
    files[entry.path] = data;
  }

  files[ASSET_ARCHIVE_MANIFEST_PATH] = encodeArchiveManifest({
    version: ASSET_ARCHIVE_VERSION,
    root: root.val,
    assets,
    missing
  });

  return Ok(zipSync(files));
}

async function flushRoot(
  backend: ArchiveBackend,
  rootId: string | undefined
): Promise<Result<AssetReferenceData | undefined, UnknownAssetError>> {
  if (rootId === undefined) {
    await backend.flush();

    return Ok(undefined);
  }

  await flushClosure(backend, rootId);
  const record = backend.catalog.record(rootId);
  if (record === undefined) {
    return Err(new UnknownAssetError(rootId));
  }

  return Ok(referenceOf(record));
}

async function flushClosure(
  backend: ArchiveBackend,
  rootId: string
): Promise<void> {
  const flushed = new Set<string>();

  let pending = [rootId];
  while (pending.length > 0) {
    for (const assetId of pending) {
      flushed.add(assetId);
      await backend.flush(assetId);
    }
    pending = backend.catalog.dependencies
      .closureOf(rootId)
      .map((reference) => reference.id)
      .filter((assetId) => !flushed.has(assetId));
  }
}

function referenceOf(
  record: AssetRecord
): AssetReferenceData {
  return {
    id: record.id.value,
    kind: record.kind
  };
}
