// Import Third-party Dependencies
import {
  ARCHIVE_MIME_TYPE,
  CATALOG_PLAN,
  CatalogRejectedError,
  type CatalogBatchReport,
  type CatalogClient,
  type ImportConflictPolicy,
  type ImportPlan
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  newAssetName,
  type AssetKindEntry
} from "../../catalog/AssetKindSet.ts";
import type { AssetPath } from "../../catalog/AssetPath.ts";
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import type { DroppedFile } from "../../files/DroppedFile.ts";
import { FileDownload } from "../../files/FileDownload.ts";
import type {
  AssetLeafData,
  AssetNodeData,
  AssetRelocation
} from "../../catalog/AssetTreeModel.ts";

// CONSTANTS
const kProjectRoot = "the project root";
const kArchiveExtension = ".zip";

export type RelocationVerb = "rename" | "move";

export type AssetCommandCatalog = Pick<
  CatalogClient,
  | "create"
  | "renameMany"
  | "removeMany"
  | "createFolder"
  | "moveFolder"
  | "removeFolder"
  | "exportArchive"
  | "planImport"
  | "importArchive"
>;

export type ConflictQuestion = (
  plan: ImportPlan
) => Promise<ImportConflictPolicy | null>;

export interface AssetCommandsOptions {
  catalog: AssetCommandCatalog;
  onError: (message: string) => void;
}

export class AssetCommands {
  #catalog: AssetCommandCatalog;
  #onError: (message: string) => void;

  constructor(
    options: AssetCommandsOptions
  ) {
    this.#catalog = options.catalog;
    this.#onError = options.onError;
  }

  async create(
    folder: AssetPath,
    kind: AssetKindEntry
  ): Promise<string | null> {
    const name = newAssetName(kind);
    try {
      return await this.#catalog.create(
        folder.child(`${name}${kind.extension}`).toString(),
        null,
        {
          kind: kind.kind,
          onConflict: "suffix"
        }
      );
    }
    catch (error) {
      this.#onError(`Could not create "${name}": ${formatReason(error)}`);

      return null;
    }
  }

  async add(
    folder: AssetPath,
    file: DroppedFile,
    convertTo: AssetKindEntry | null = null
  ): Promise<string | null> {
    const name = convertTo === null ?
      file.name :
      `${file.stem}${convertTo.extension}`;
    try {
      return await this.#catalog.create(
        folder.child(name).toString(),
        await file.bytes(),
        {
          kind: convertTo?.kind,
          from: convertTo === null ? undefined : file.format,
          onConflict: "suffix"
        }
      );
    }
    catch (error) {
      this.#onError(`Could not add "${file.name}": ${formatReason(error)}`);

      return null;
    }
  }

  async importArchive(
    file: DroppedFile,
    askConflicts: ConflictQuestion
  ): Promise<boolean> {
    try {
      const content = await file.bytes();
      const plan = await this.#catalog.planImport(content);
      const onConflict = plan.live.length === 0 ?
        "keep" :
        await askConflicts(plan);
      if (onConflict === null) {
        return true;
      }

      const report = await this.#catalog.importArchive(content, { onConflict });
      for (const failure of report.failed) {
        this.#onError(`Could not import "${failure.path}": ${failure.reason}`);
      }
    }
    catch (error) {
      if (
        error instanceof CatalogRejectedError &&
        error.command === CATALOG_PLAN
      ) {
        return false;
      }
      this.#onError(`Could not import "${file.name}": ${formatReason(error)}`);
    }

    return true;
  }

  async createFolder(
    path: AssetPath
  ): Promise<boolean> {
    try {
      await this.#catalog.createFolder(path.toString());

      return true;
    }
    catch (error) {
      this.#onError(`Could not create "${path.name}": ${formatReason(error)}`);

      return false;
    }
  }

  async relocate(
    relocations: readonly AssetRelocation[],
    verb: RelocationVerb
  ): Promise<AssetRelocation | null> {
    const report = await settle(this.#catalog.renameMany(
      relocations.flatMap((relocation) => relocation.renames)
    ));
    const failed = relocationAt(relocations, report.applied);
    for (const relocation of relocations) {
      if (report.failure !== undefined && relocation === failed) {
        this.#onError(relocationFailure({
          verb,
          relocations,
          failed,
          applied: report.applied,
          reason: report.failure
        }));

        return failed;
      }
      if (relocation.type === "folder") {
        await this.#moveFolder(relocation, verb);
      }
    }

    return null;
  }

  async remove(
    deletion: AssetDeletion,
    withCompanions: boolean
  ): Promise<void> {
    const assets = deletion.removals(withCompanions);
    const report = await settle(this.#catalog.removeMany(
      assets.map((asset) => asset.id),
      { force: true }
    ));
    if (report.failure !== undefined) {
      this.#onError(
        removalFailure(
          deletion.targets,
          report.applied,
          assets,
          report.failure
        )
      );

      return;
    }

    for (const folder of deletion.folders) {
      try {
        await this.#catalog.removeFolder(folder.toString());
      }
      catch (error) {
        this.#onError(`Could not delete "${folder.name}": ${formatReason(error)}`);
      }
    }
  }

  async export(
    asset: AssetLeafData
  ): Promise<void> {
    try {
      const bytes = await this.#catalog.exportArchive(asset.id);
      new FileDownload(
        new Blob([Uint8Array.from(bytes)], { type: ARCHIVE_MIME_TYPE }),
        `${asset.path.stem || asset.id}${kArchiveExtension}`
      ).save();
    }
    catch (error) {
      this.#onError(`Could not export "${asset.path.name}": ${formatReason(error)}`);
    }
  }

  async #moveFolder(
    relocation: AssetRelocation,
    verb: RelocationVerb
  ): Promise<void> {
    try {
      await this.#catalog.moveFolder(
        relocation.from.toString(),
        relocation.to.toString()
      );
    }
    catch (error) {
      const doing = verb === "rename" ? "renaming" : "moving";
      this.#onError(
        `Could not finish ${doing} "${relocation.from.name}": ${formatReason(error)}`
      );
    }
  }
}

interface RelocationFailure {
  verb: RelocationVerb;
  relocations: readonly AssetRelocation[];
  failed: AssetRelocation;
  applied: number;
  reason: string;
}

function relocationFailure(
  failure: RelocationFailure
): string {
  const {
    verb,
    relocations,
    failed,
    applied,
    reason
  } = failure;
  if (relocations.length > 1) {
    const total = relocations.reduce(
      (sum, relocation) => sum + relocation.renames.length,
      0
    );

    return `Moved ${applied} of ${total} assets: ${reason}`;
  }

  const total = failed.renames.length;
  const name = failed.from.name;
  if (total > 1 && applied > 0) {
    const done = verb === "rename" ? "Renamed" : "Moved";

    return `${done} ${applied} of ${total} assets under "${name}": ${reason}`;
  }
  if (verb === "rename") {
    return `Could not rename "${name}" to "${failed.to.name}": ${reason}`;
  }

  const folder = failed.to.parent;

  return `Could not move "${name}" to ${folder.isRoot ? kProjectRoot : `"${folder}"`}: ${reason}`;
}

function removalFailure(
  targets: readonly AssetNodeData[],
  removed: number,
  assets: readonly AssetLeafData[],
  reason: string
): string {
  const [target] = targets;
  const single = targets.length === 1 ? target : undefined;
  const [asset] = assets;
  if (assets.length === 1 && asset !== undefined) {
    return `Could not delete "${(single ?? asset).path.name}": ${reason}`;
  }

  return single?.type === "folder" ?
    `Deleted ${removed} of ${assets.length} assets under "${single.path.name}": ${reason}` :
    `Deleted ${removed} of ${assets.length} assets: ${reason}`;
}

function relocationAt(
  relocations: readonly AssetRelocation[],
  renameIndex: number
): AssetRelocation | undefined {
  let start = 0;
  for (const relocation of relocations) {
    start += relocation.renames.length;
    if (renameIndex < start) {
      return relocation;
    }
  }

  return undefined;
}

async function settle(
  request: Promise<CatalogBatchReport>
): Promise<CatalogBatchReport> {
  try {
    return await request;
  }
  catch (error) {
    return {
      applied: 0,
      failure: formatReason(error)
    };
  }
}

function formatReason(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}
