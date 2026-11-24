// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { isStatePath } from "@jolly-pixel/asset-source";
import { unzipSync } from "fflate";

// Import Internal Dependencies
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import type { ArchiveBudget } from "./ArchiveBudget.ts";

// CONSTANTS
const kResourceForkDirectory = "__MACOSX/";
const kFinderMetadataName = ".DS_Store";

export class ArchiveFiles {
  #files = new Map<string, Uint8Array>();
  #parts = new Map<string, string>();

  static unzip(
    bytes: Uint8Array,
    budget: ArchiveBudget
  ): Result<ArchiveFiles, AssetArchiveError> {
    let oversized: AssetArchiveError | undefined;
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bytes, {
        filter: (file) => {
          if (oversized === undefined) {
            const admitted = budget.admit(file.name, file.originalSize);
            if (!admitted.ok) {
              oversized = admitted.val;
            }
          }

          return oversized === undefined;
        }
      });
    }
    catch (cause) {
      const error = new AssetArchiveError(
        "corrupt",
        "Archive is not a readable ZIP file.",
        { cause }
      );

      return Err(error);
    }
    if (oversized !== undefined) {
      return Err(oversized);
    }

    const files = new ArchiveFiles();
    for (const [name, data] of Object.entries(unzipped)) {
      if (isStatePath(name)) {
        const error = new AssetArchiveError(
          "reserved-path",
          `Archive entry "${name}" is reserved.`
        );

        return Err(error);
      }
      if (!isOperatingSystemEntry(name)) {
        files.#add(name, data);
      }
    }

    return Ok(files);
  }

  take(
    path: string
  ): Uint8Array | undefined {
    const data = this.#files.get(path);
    this.#files.delete(path);

    return data;
  }

  takePart(
    assetPath: string,
    partId: string
  ): Uint8Array | undefined {
    const path = this.#parts.get(`${assetPath}.parts/${partId}`);

    return path === undefined ? undefined : this.take(path);
  }

  firstUntaken(): string | undefined {
    const [path] = this.#files.keys();

    return path;
  }

  #add(
    path: string,
    data: Uint8Array
  ): void {
    this.#files.set(path, data);

    const key = partKey(path);
    if (key !== null && !this.#parts.has(key)) {
      this.#parts.set(key, path);
    }
  }
}

function partKey(
  path: string
): string | null {
  const leaf = path.lastIndexOf("/") + 1;
  const dot = path.indexOf(".", leaf);

  return leaf === 0 || dot === -1 ? null : path.slice(0, dot);
}

function isOperatingSystemEntry(
  name: string
): boolean {
  return name.endsWith("/") ||
    name.startsWith(kResourceForkDirectory) ||
    name === kFinderMetadataName ||
    name.endsWith(`/${kFinderMetadataName}`);
}
