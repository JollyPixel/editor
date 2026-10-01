// Import Third-party Dependencies
import {
  ARCHIVE_MIME_TYPE,
  type CatalogClient
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
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
  "rename" | "remove" | "exportArchive"
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

  async relocate(
    relocations: readonly AssetRelocation[],
    verb: RelocationVerb
  ): Promise<AssetRelocation | null> {
    let applied = 0;
    for (const relocation of relocations) {
      for (const rename of relocation.renames) {
        try {
          await this.#catalog.rename(
            rename.assetId,
            rename.to
          );
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
        applied++;
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
