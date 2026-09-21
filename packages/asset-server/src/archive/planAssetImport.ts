// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  ArchiveBackend,
  AssetArchive,
  AssetArchiveAsset,
  AssetArchiveEntry,
  ImportPlan,
  SharedDependents
} from "./AssetArchive.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";
import { UnknownAssetKindError } from "../kinds/errors/UnknownAssetKindError.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import { asError } from "../utils/asError.ts";

export type AssetImportError = AssetArchiveError | UnknownAssetKindError;

export function planAssetImport(
  backend: ArchiveBackend,
  archive: AssetArchive
): Result<ImportPlan, AssetImportError> {
  const { catalog, kinds } = backend;
  const archived = new Set(archive.assets.map((asset) => asset.id));

  const live: AssetArchiveEntry[] = [];
  const fresh: AssetArchiveEntry[] = [];
  const sharedDependents: SharedDependents[] = [];
  for (const asset of archive.assets) {
    const readable = dryRun(kinds, asset);
    if (!readable.ok) {
      return readable;
    }

    const current = entryOf(catalog, asset.id);
    if (current === undefined) {
      fresh.push({
        id: asset.id,
        kind: asset.kind,
        path: asset.path
      });

      continue;
    }
    if (current.kind !== asset.kind) {
      return Err(new AssetArchiveError(
        "kind-mismatch",
        `Asset "${asset.id}" is a "${current.kind}" in this workspace, ` +
        `not a "${asset.kind}".`,
        { assetId: asset.id }
      ));
    }

    live.push(current);
    const dependents = catalog
      .dependentsOf(asset.id)
      .filter((assetId) => !archived.has(assetId))
      .flatMap((assetId) => entryOf(catalog, assetId) ?? []);
    if (dependents.length > 0) {
      sharedDependents.push({
        ...current,
        dependents
      });
    }
  }

  return Ok({
    root: archive.root,
    live,
    fresh,
    sharedDependents
  });
}

function dryRun(
  kinds: AssetKindRegistry,
  asset: AssetArchiveAsset
): Result<void, AssetImportError> {
  if (!kinds.has(asset.kind)) {
    return Err(new UnknownAssetKindError(asset.kind));
  }

  const handler = kinds.get(asset.kind);
  try {
    handler.load(handler.create(asset.id), asset.data);
  }
  catch (cause) {
    return Err(new AssetArchiveError(
      "unreadable-asset",
      `Asset "${asset.path}" is not a readable "${asset.kind}": ` +
      `${asError(cause).message}`,
      {
        assetId: asset.id,
        cause
      }
    ));
  }

  return Ok(undefined);
}

function entryOf(
  catalog: CatalogProjection,
  assetId: string
): AssetArchiveEntry | undefined {
  const record = catalog.record(assetId);

  return record === undefined ?
    undefined :
    {
      id: assetId,
      kind: record.kind,
      path: record.source
    };
}
