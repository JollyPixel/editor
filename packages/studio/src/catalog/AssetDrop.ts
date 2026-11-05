// Import Internal Dependencies
import type {
  AssetKindEntry,
  AssetKindSet
} from "./AssetKindSet.ts";
import type { DroppedFile } from "../browser/DroppedFile.ts";

// CONSTANTS
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

  constructor(
    files: Iterable<DroppedFile>,
    kinds: AssetKindSet
  ) {
    const archives: DroppedFile[] = [];
    const plain: DroppedFile[] = [];
    const byFormat = new Map<string, DroppedFile[]>();
    for (const dropped of files) {
      if (dropped.format === kArchiveFormat) {
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
    this.convertible = Array.from(byFormat, ([format, grouped]) => {
      return {
        format,
        files: grouped,
        kinds: kinds.convertingFrom(format)
      };
    });
  }
}
