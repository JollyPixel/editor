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
  AssetArchiveEntry,
  ImportConflictPolicy,
  ImportFailure,
  ImportReport
} from "./AssetArchive.ts";
import {
  planAssetImport,
  type AssetImportError
} from "./planAssetImport.ts";

export interface ImportAssetArchiveOptions {
  onConflict: ImportConflictPolicy;
  actor: EventStore.Actor;
}

export async function importAssetArchive(
  backend: ArchiveBackend,
  archive: AssetArchive,
  options: ImportAssetArchiveOptions
): Promise<Result<ImportReport, AssetImportError>> {
  const plan = planAssetImport(backend, archive);
  if (!plan.ok) {
    return plan;
  }

  const { writer } = backend;
  const { onConflict, actor } = options;
  const live = new Map(plan.val.live.map((entry) => [entry.id, entry]));

  const created: AssetArchiveEntry[] = [];
  const replaced: AssetArchiveEntry[] = [];
  const kept: AssetArchiveEntry[] = [];
  const failed: ImportFailure[] = [];
  for (const asset of archive.assets) {
    const { id, kind, path, data } = asset;
    const current = live.get(id);

    if (current !== undefined && onConflict === "keep") {
      kept.push(current);

      continue;
    }

    const written = current === undefined ?
      await writer.create({
        path,
        kind,
        data,
        assetId: id,
        onPathConflict: "suffix",
        actor
      }) :
      await writer.update({
        assetId: id,
        data,
        actor
      });
    if (!written.ok) {
      failed.push({
        id,
        kind,
        path: current?.path ?? path,
        reason: written.val.message
      });

      continue;
    }

    (current === undefined ? created : replaced).push({
      id,
      kind,
      path: backend.catalog.record(id)?.source ?? current?.path ?? path
    });
  }

  for (const { id } of [...created, ...replaced]) {
    await backend.flush(id);
  }

  return Ok({
    root: archive.root,
    created,
    replaced,
    kept,
    failed
  });
}
