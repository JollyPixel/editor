// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  ArchiveBackend,
  AssetArchive,
  AssetArchiveAsset,
  AssetArchiveEntry
} from "../AssetArchive.ts";
import type {
  AssetImportError,
  ImportPlan,
  SharedDependents
} from "./AssetImport.ts";
import { archiveEntryOf } from "../format/ArchiveManifest.ts";
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import { UnknownAssetKindError } from "../../kinds/errors/UnknownAssetKindError.ts";
import type { AssetKindRegistry } from "../../kinds/AssetKindRegistry.ts";
import type { CatalogProjection } from "../../catalog/CatalogProjection.ts";
import { asError } from "../../utils/asError.ts";

export class AssetImportPlan {
  readonly root: AssetReferenceData | undefined;
  #live = new Map<string, AssetArchiveEntry>();
  #fresh: AssetArchiveEntry[] = [];
  #sharedDependents: SharedDependents[] = [];
  #incompatible: AssetArchiveEntry[] = [];

  static of(
    backend: ArchiveBackend,
    archive: AssetArchive
  ): Result<AssetImportPlan, AssetImportError> {
    const plan = new AssetImportPlan(archive.root);
    const archived = new Set(archive.assets.map((asset) => asset.id));

    for (const asset of archive.assets) {
      const readable = dryRun(backend.kinds, asset);
      if (!readable.ok) {
        return readable;
      }
      plan.#classify(backend.catalog, asset, archived);
    }

    return Ok(plan);
  }

  constructor(
    root: AssetReferenceData | undefined
  ) {
    this.root = root;
  }

  current(
    assetId: string
  ): AssetArchiveEntry | undefined {
    return this.#live.get(assetId);
  }

  rejectIncompatible(): Result<void, AssetArchiveError> {
    const [incompatible] = this.#incompatible;
    if (incompatible === undefined) {
      return Ok(undefined);
    }

    const error = new AssetArchiveError(
      "kind-mismatch",
      `Asset "${incompatible.id}" is a "${incompatible.kind}" in this ` +
      "workspace, with a different kind in the archive.",
      { assetId: incompatible.id }
    );

    return Err(error);
  }

  toJSON(): ImportPlan {
    return {
      root: this.root,
      live: [...this.#live.values()],
      fresh: [...this.#fresh],
      sharedDependents: [...this.#sharedDependents],
      incompatible: [...this.#incompatible]
    };
  }

  #classify(
    catalog: CatalogProjection,
    asset: AssetArchiveAsset,
    archived: ReadonlySet<string>
  ): void {
    const record = catalog.record(asset.id);
    if (record === undefined) {
      this.#fresh.push({
        id: asset.id,
        kind: asset.kind,
        path: asset.path
      });

      return;
    }

    const current = archiveEntryOf(record);
    this.#live.set(asset.id, current);
    if (current.kind !== asset.kind) {
      this.#incompatible.push(current);

      return;
    }

    const dependents = catalog
      .dependentsOf(asset.id)
      .filter((dependent) => !archived.has(dependent.id.value))
      .map((dependent) => archiveEntryOf(dependent));
    if (dependents.length > 0) {
      this.#sharedDependents.push({
        ...current,
        dependents
      });
    }
  }
}

function dryRun(
  kinds: AssetKindRegistry,
  asset: AssetArchiveAsset
): Result<void, AssetImportError> {
  if (!kinds.has(asset.kind)) {
    const error = new UnknownAssetKindError(asset.kind);

    return Err(error);
  }

  const handler = kinds.get(asset.kind);
  try {
    handler.load(handler.create(asset.id), asset.data);
  }
  catch (cause) {
    const error = new AssetArchiveError(
      "unreadable-asset",
      `Asset "${asset.path}" is not a readable "${asset.kind}": ` +
      `${asError(cause).message}`,
      {
        assetId: asset.id,
        cause
      }
    );

    return Err(error);
  }

  return Ok(undefined);
}
