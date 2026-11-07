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
import type { Notifier } from "@jolly-pixel/ui";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  newAssetName,
  type AssetKindEntry
} from "../../catalog/AssetKindSet.ts";
import type { AssetPath } from "../../catalog/AssetPath.ts";
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import type { DroppedFile } from "../../browser/DroppedFile.ts";
import { FileDownload } from "../../browser/FileDownload.ts";
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
  | "replace"
>;

export type ConflictQuestion = (
  plan: ImportPlan
) => Promise<ImportConflictPolicy | null>;

export interface AssetCommandsOptions {
  catalog: AssetCommandCatalog;
  notifications: Notifier;
  onError: (message: string) => void;
}

export class AssetCommands {
  #catalog: AssetCommandCatalog;
  #notifications: Notifier;
  #onError: (message: string) => void;

  constructor(
    options: AssetCommandsOptions
  ) {
    this.#catalog = options.catalog;
    this.#notifications = options.notifications;
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
      this.#onError(`Could not create "${name}": ${errorMessage(error)}`);

      return null;
    }
  }

  async add(
    path: AssetPath,
    file: DroppedFile,
    convertTo: AssetKindEntry | null = null
  ): Promise<string> {
    return this.#catalog.create(
      path.toString(),
      await file.bytes(),
      {
        kind: convertTo?.kind,
        from: convertTo === null ? undefined : file.format,
        onConflict: "suffix"
      }
    );
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
      if (onConflict !== null) {
        await this.#import(file.name, content, onConflict);
      }
    }
    catch (error) {
      if (
        error instanceof CatalogRejectedError &&
        error.command === CATALOG_PLAN
      ) {
        return false;
      }
      this.#onError(`Could not import "${file.name}": ${errorMessage(error)}`);
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
      this.#onError(`Could not create "${path.name}": ${errorMessage(error)}`);

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
        this.#onError(`Could not delete "${folder.name}": ${errorMessage(error)}`);
      }
    }
  }

  async replace(
    asset: AssetLeafData,
    file: DroppedFile,
    entry: AssetKindEntry | undefined
  ): Promise<boolean> {
    const { name, extension } = asset.path;
    const sameFormat = file.name.toLowerCase().endsWith(extension.toLowerCase());
    if (!sameFormat && entry?.convertsFrom?.includes(file.format) !== true) {
      this.#onError(`Could not replace "${name}" with "${file.name}": it is not a ${extension} file`);

      return false;
    }

    const replacing = this.#notifications.notify({
      tone: "loading",
      title: `Replacing "${name}"`,
      message: `with "${file.name}"`
    });
    try {
      await this.#catalog.replace(asset.id, await file.bytes(), {
        from: sameFormat ? undefined : file.format
      });
      replacing.update({
        tone: "success",
        title: `Replaced "${name}"`
      });

      return true;
    }
    catch (error) {
      replacing.update({
        tone: "error",
        title: `Could not replace "${name}"`,
        message: errorMessage(error)
      });

      return false;
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
      this.#onError(`Could not export "${asset.path.name}": ${errorMessage(error)}`);
    }
  }

  async #import(
    name: string,
    content: Uint8Array,
    onConflict: ImportConflictPolicy
  ): Promise<void> {
    const importing = this.#notifications.notify({
      tone: "loading",
      title: `Importing "${name}"`
    });
    try {
      const { failed } = await this.#catalog.importArchive(content, {
        onConflict
      });
      importing.update({
        tone: failed.length === 0 ? "success" : "warning",
        title: `Imported "${name}"`,
        message: failed
          .map((failure) => `"${failure.path}": ${failure.reason}`)
          .join("\n")
      });
    }
    catch (error) {
      importing.update({
        tone: "error",
        title: `Could not import "${name}"`,
        message: errorMessage(error)
      });
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
        `Could not finish ${doing} "${relocation.from.name}": ${errorMessage(error)}`
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
      failure: errorMessage(error)
    };
  }
}
