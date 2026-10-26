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
  toArchiveEntry,
  encodeArchiveManifest
} from "./format/ArchiveManifest.ts";
import { readableAsset } from "./readableAsset.ts";
import { UnknownAssetError } from "../../storage/writer/errors/UnknownAssetError.ts";
import { AssetPartFiles } from "../../storage/AssetPartFiles.ts";

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
    Array.from(catalog.catalog, toReference) :
    [root.val];

  const partFiles = new AssetPartFiles(backend.kinds);
  const assets: AssetArchiveEntry[] = [];
  const missing: AssetReferenceData[] = [];
  const files: Zippable = {};
  for (const reference of catalog.dependencies.dependenciesFirst(starts)) {
    const record = catalog.record(reference.id);
    if (record === undefined) {
      missing.push(reference);

      continue;
    }

    const listed = toArchiveEntry(record);
    const data = await backend.source.read(listed.path);
    const parts = await readPartFiles(backend, partFiles, listed, data);
    const entry = parts === undefined ?
      listed :
      { ...listed, parts: [...parts.keys()] };
    const readable = readableAsset(backend.kinds, {
      ...entry,
      data,
      partData: new Map(
        [...parts ?? []].map(([partId, part]) => [partId, part.data])
      )
    });
    if (!readable.ok) {
      return readable;
    }

    assets.push(entry);
    files[entry.path] = data;
    for (const part of parts?.values() ?? []) {
      files[part.path] = part.data;
    }
  }

  files[ASSET_ARCHIVE_MANIFEST_PATH] = encodeArchiveManifest({
    version: ASSET_ARCHIVE_VERSION,
    root: root.val,
    assets,
    missing
  });

  return Ok(zipSync(files));
}

async function readPartFiles(
  backend: ArchiveBackend,
  partFiles: AssetPartFiles,
  entry: AssetArchiveEntry,
  data: Uint8Array
): Promise<Map<string, { path: string; data: Uint8Array; }> | undefined> {
  const extension = partFiles.extension(entry.kind);
  const kindParts = backend.kinds.has(entry.kind) ?
    backend.kinds.get(entry.kind).parts :
    undefined;
  if (extension === null || kindParts === undefined) {
    return undefined;
  }

  let listed: Iterable<string>;
  try {
    listed = kindParts.list(data);
  }
  catch {
    return undefined;
  }

  const parts = new Map<string, { path: string; data: Uint8Array; }>();
  for (const partId of listed) {
    const path = partFiles.path(entry.path, extension, partId);
    parts.set(partId, {
      path,
      data: await backend.source.read(path)
    });
  }

  return parts;
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
    const error = new UnknownAssetError(rootId);

    return Err(error);
  }

  return Ok(toReference(record));
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
      .transitiveDependencies(rootId)
      .map((reference) => reference.id)
      .filter((assetId) => !flushed.has(assetId));
  }
}

function toReference(
  record: AssetRecord
): AssetReferenceData {
  return {
    id: record.id.value,
    kind: record.kind.value
  };
}
