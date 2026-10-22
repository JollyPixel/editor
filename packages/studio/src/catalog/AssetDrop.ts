// Import Internal Dependencies
import type {
  AssetKindEntry,
  AssetKindSet
} from "./AssetKindSet.ts";
import { DroppedFile } from "../browser/DroppedFile.ts";

// CONSTANTS
export const MAX_DROPPED_FILE_MB = 10;
const kMaxDroppedFileBytes = MAX_DROPPED_FILE_MB * 1024 * 1024;
const kArchiveFormat = ".zip";

export interface ConvertibleFiles {
  readonly format: string;
  readonly files: readonly DroppedFile[];
  readonly kinds: readonly AssetKindEntry[];
}

export interface ConversionChoice {
  readonly convertTo: AssetKindEntry | null;
}

export class AssetDrop {
  readonly archives: readonly DroppedFile[];
  readonly convertible: readonly ConvertibleFiles[];
  readonly files: readonly DroppedFile[];
  readonly oversized: readonly DroppedFile[];

  constructor(
    files: Iterable<File>,
    kinds: AssetKindSet
  ) {
    const archives: DroppedFile[] = [];
    const plain: DroppedFile[] = [];
    const oversized: DroppedFile[] = [];
    const byFormat = new Map<string, DroppedFile[]>();
    for (const file of files) {
      const dropped = new DroppedFile(file);
      if (dropped.size > kMaxDroppedFileBytes) {
        oversized.push(dropped);
      }
      else if (dropped.format === kArchiveFormat) {
        archives.push(dropped);
      }
      else if (kinds.convertingFrom(dropped.format).length > 0) {
        byFormat.set(dropped.format, [
          ...byFormat.get(dropped.format) ?? [],
          dropped
        ]);
      }
      else {
        plain.push(dropped);
      }
    }

    this.archives = archives;
    this.files = plain;
    this.oversized = oversized;
    this.convertible = Array.from(byFormat, ([format, grouped]) => {
      return {
        format,
        files: grouped,
        kinds: kinds.convertingFrom(format)
      };
    });
  }
}
