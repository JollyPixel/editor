// Import Third-party Dependencies
import type {
  AssetRecord,
  AssetReferenceData
} from "@jolly-pixel/asset";
import {
  strToU8,
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  ASSET_ARCHIVE_VERSION,
  type ArchiveBackend,
  type AssetArchiveEntry,
  type AssetArchiveManifest
} from "./AssetArchive.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";

export interface ExportAssetArchiveOptions {
  root?: string;
}

export async function exportAssetArchive(
  backend: ArchiveBackend,
  options: ExportAssetArchiveOptions = {}
): Promise<Uint8Array> {
  const { root } = options;
  const { catalog } = backend;

  if (root === undefined) {
    await backend.flush();
  }
  else {
    await flushClosure(backend, root);
  }

  const rootRecord = root === undefined ? undefined : catalog.record(root);
  if (root !== undefined && rootRecord === undefined) {
    throw new AssetArchiveError(
      "unknown-root",
      `Unknown asset "${root}".`,
      { assetId: root }
    );
  }

  const assets: AssetArchiveEntry[] = [];
  const missing: AssetReferenceData[] = [];
  const files: Zippable = {};
  const starts = rootRecord === undefined ? catalog.catalog : [rootRecord];
  for (const reference of dependenciesFirst(catalog, starts)) {
    const record = catalog.record(reference.id);
    if (record === undefined) {
      missing.push(reference);

      continue;
    }

    assets.push({
      id: reference.id,
      kind: record.kind,
      path: record.source
    });
    files[record.source] = await backend.source.read(record.source);
  }

  const manifest: AssetArchiveManifest = {
    version: ASSET_ARCHIVE_VERSION,
    root: rootRecord === undefined ?
      undefined :
      {
        id: rootRecord.id.value,
        kind: rootRecord.kind
      },
    assets,
    missing
  };
  files[ASSET_ARCHIVE_MANIFEST_PATH] = strToU8(
    JSON.stringify(manifest, null, 2)
  );

  return zipSync(files);
}

async function flushClosure(
  backend: ArchiveBackend,
  root: string
): Promise<void> {
  const flushed = new Set<string>();

  let pending = [root];
  while (pending.length > 0) {
    for (const assetId of pending) {
      flushed.add(assetId);
      await backend.flush(assetId);
    }
    pending = backend.catalog
      .closureOf(root)
      .map((reference) => reference.id)
      .filter((assetId) => !flushed.has(assetId));
  }
}

function dependenciesFirst(
  catalog: CatalogProjection,
  starts: Iterable<AssetRecord>
): AssetReferenceData[] {
  const visited = new Set<string>();
  const ordered: AssetReferenceData[] = [];

  function visit(
    reference: AssetReferenceData
  ): void {
    if (visited.has(reference.id)) {
      return;
    }
    visited.add(reference.id);
    for (const dependency of catalog.dependenciesOf(reference.id)) {
      visit(dependency);
    }
    ordered.push(reference);
  }

  for (const record of starts) {
    visit({
      id: record.id.value,
      kind: record.kind
    });
  }

  return ordered;
}
