// Import Third-party Dependencies
import {
  ARCHIVE_MIME_TYPE,
  type CatalogClient
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  newAssetName,
  type AssetKindEntry
} from "../../catalog/AssetKindSet.ts";
import type { AssetPath } from "../../catalog/AssetPath.ts";
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
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
  | "rename"
  | "remove"
  | "createFolder"
  | "moveFolder"
  | "removeFolder"
  | "exportArchive"
>;

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
      this.#onError(`Could not create "${name}": ${reasonOf(error)}`);

      return null;
    }
  }

  async createFolder(
    path: AssetPath
  ): Promise<boolean> {
    try {
      await this.#catalog.createFolder(path.toString());

      return true;
    }
    catch (error) {
      this.#onError(`Could not create "${path.name}": ${reasonOf(error)}`);

      return false;
    }
  }

  async relocate(
    relocations: readonly AssetRelocation[],
    verb: RelocationVerb
  ): Promise<AssetRelocation | null> {
    let applied = 0;
    for (const relocation of relocations) {
      try {
        for (const rename of relocation.renames) {
          await this.#catalog.rename(
            rename.assetId,
            rename.to
          );
          applied++;
        }
      }
      catch (error) {
        this.#onError(relocationFailure({
          verb,
          relocations,
          failed: relocation,
          applied,
          error
        }));

        return relocation;
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
    let removed = 0;
    try {
      for (const asset of assets) {
        await this.#catalog.remove(
          asset.id,
          { force: true }
        );
        removed++;
      }
    }
    catch (error) {
      this.#onError(
        removalFailure(
          deletion.targets,
          removed,
          assets,
          error
        )
      );

      return;
    }

    for (const folder of deletion.folders) {
      try {
        await this.#catalog.removeFolder(folder.toString());
      }
      catch (error) {
        this.#onError(`Could not delete "${folder.name}": ${reasonOf(error)}`);
      }
    }
  }

  async export(
    asset: AssetLeafData
  ): Promise<void> {
    try {
      const bytes = await this.#catalog.exportArchive(asset.id);
      download(
        new Blob([Uint8Array.from(bytes)], { type: ARCHIVE_MIME_TYPE }),
        `${asset.path.stem || asset.id}${kArchiveExtension}`
      );
    }
    catch (error) {
      this.#onError(`Could not export "${asset.path.name}": ${reasonOf(error)}`);
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
        `Could not finish ${doing} "${relocation.from.name}": ${reasonOf(error)}`
      );
    }
  }
}

interface RelocationFailure {
  verb: RelocationVerb;
  relocations: readonly AssetRelocation[];
  failed: AssetRelocation;
  applied: number;
  error: unknown;
}

function relocationFailure(
  failure: RelocationFailure
): string {
  const { verb, relocations, failed, applied } = failure;
  const reason = reasonOf(failure.error);
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
  error: unknown
): string {
  const reason = reasonOf(error);
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

function reasonOf(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

function download(
  blob: Blob,
  fileName: string
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
