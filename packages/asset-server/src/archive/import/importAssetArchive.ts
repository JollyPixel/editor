// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  ArchiveBackend,
  AssetArchive,
  AssetArchiveAsset,
  AssetArchiveEntry
} from "../AssetArchive.ts";
import type {
  AssetImportError,
  ImportConflictPolicy,
  ImportFailure,
  ImportPlan,
  ImportReport
} from "./AssetImport.ts";
import { AssetImportPlan } from "./AssetImportPlan.ts";
import { copyWithFreshIds } from "./copyWithFreshIds.ts";

export interface ImportAssetArchiveOptions {
  onConflict: ImportConflictPolicy;
  actor: EventStore.Actor;
}

export function planAssetImport(
  backend: ArchiveBackend,
  archive: AssetArchive
): Result<ImportPlan, AssetImportError> {
  return AssetImportPlan.of(backend, archive).map((plan) => plan.toJSON());
}

export async function importAssetArchive(
  backend: ArchiveBackend,
  archive: AssetArchive,
  options: ImportAssetArchiveOptions
): Promise<Result<ImportReport, AssetImportError>> {
  const { onConflict, actor } = options;
  const plan = AssetImportPlan.of(backend, archive);
  if (!plan.ok) {
    return plan;
  }

  const source = onConflict === "copy" ?
    await copyWithFreshIds(archive, backend.kinds) :
    plan.val.rejectIncompatible().map(() => archive);
  if (!source.ok) {
    return source;
  }

  const created: AssetArchiveEntry[] = [];
  const replaced: AssetArchiveEntry[] = [];
  const kept: AssetArchiveEntry[] = [];
  const failed: ImportFailure[] = [];
  for (const asset of source.val.assets) {
    const current = plan.val.current(asset.id);
    if (current !== undefined && onConflict === "keep") {
      kept.push(current);

      continue;
    }

    const written = await write(backend, asset, current, actor);
    const path = current?.path ?? asset.path;
    if (!written.ok) {
      failed.push({
        id: asset.id,
        kind: asset.kind,
        path,
        reason: written.val.message
      });

      continue;
    }

    (current === undefined ? created : replaced).push({
      id: asset.id,
      kind: asset.kind,
      path: backend.catalog.record(asset.id)?.source ?? path
    });
  }

  for (const { id } of [...created, ...replaced]) {
    await backend.flush(id);
  }

  return Ok({
    root: source.val.root,
    created,
    replaced,
    kept,
    failed
  });
}

function write(
  backend: ArchiveBackend,
  asset: AssetArchiveAsset,
  current: AssetArchiveEntry | undefined,
  actor: EventStore.Actor
): Promise<Result<EventStore.Event, Error>> {
  if (current === undefined) {
    return backend.writer.create({
      path: asset.path,
      kind: asset.kind,
      data: asset.data,
      assetId: asset.id,
      onPathConflict: "suffix",
      actor
    });
  }

  return backend.writer.update({
    assetId: asset.id,
    data: asset.data,
    actor
  });
}
