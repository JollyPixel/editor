// Import Third-party Dependencies
import type {
  AssetRecord,
  AssetReferenceData
} from "@jolly-pixel/asset";
import {
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  ASSET_ARCHIVE_VERSION,
  type ArchiveBackend,
  type AssetArchiveEntry
} from "./AssetArchive.ts";
import {
  archiveEntryOf,
  encodeArchiveManifest
} from "./format/ArchiveManifest.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";

export interface ExportAssetArchiveOptions {
  root?: string;
}

export async function exportAssetArchive(
  backend: ArchiveBackend,
  options: ExportAssetArchiveOptions = {}
): Promise<Uint8Array> {
  const { catalog } = backend;
  const root = await flushRoot(backend, options.root);
  const starts = root === undefined ?
    Array.from(catalog.catalog, referenceOf) :
    [root];

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
    assets.push(entry);
    files[entry.path] = await backend.source.read(entry.path);
  }

  files[ASSET_ARCHIVE_MANIFEST_PATH] = encodeArchiveManifest({
    version: ASSET_ARCHIVE_VERSION,
    root,
    assets,
    missing
  });

  return zipSync(files);
}

async function flushRoot(
  backend: ArchiveBackend,
  rootId: string | undefined
): Promise<AssetReferenceData | undefined> {
  if (rootId === undefined) {
    await backend.flush();

    return undefined;
  }

  await flushClosure(backend, rootId);
  const record = backend.catalog.record(rootId);
  if (record === undefined) {
    throw new AssetArchiveError(
      "unknown-root",
      `Unknown asset "${rootId}".`,
      { assetId: rootId }
    );
  }

  return referenceOf(record);
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
