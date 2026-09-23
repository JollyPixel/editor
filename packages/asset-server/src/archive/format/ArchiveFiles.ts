// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { isStatePath } from "@jolly-pixel/asset-source/core";
import { unzipSync } from "fflate";

// Import Internal Dependencies
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";

// CONSTANTS
const kResourceForkDirectory = "__MACOSX/";
const kFinderMetadataName = ".DS_Store";

export interface ArchiveFilesLimits {
  maxEntryBytes: number;
  maxBytes: number;
}

export class ArchiveFiles {
  #files = new Map<string, Uint8Array>();

  static unzip(
    bytes: Uint8Array,
    limits: ArchiveFilesLimits
  ): Result<ArchiveFiles, AssetArchiveError> {
    const { maxEntryBytes, maxBytes } = limits;

    let total = 0;
    let oversized: AssetArchiveError | undefined;
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bytes, {
        filter: (file) => {
          total += file.originalSize;
          if (file.originalSize > maxEntryBytes) {
            oversized ??= new AssetArchiveError(
              "too-large",
              `Archive entry "${file.name}" exceeds ${maxEntryBytes} bytes.`
            );
          }
          else if (total > maxBytes) {
            oversized ??= new AssetArchiveError(
              "too-large",
              `Archive exceeds ${maxBytes} decoded bytes.`
            );
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
        files.#files.set(name, data);
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

  firstUntaken(): string | undefined {
    const [path] = this.#files.keys();

    return path;
  }
}

function isOperatingSystemEntry(
  name: string
): boolean {
  return name.endsWith("/") ||
    name.startsWith(kResourceForkDirectory) ||
    name === kFinderMetadataName ||
    name.endsWith(`/${kFinderMetadataName}`);
}
