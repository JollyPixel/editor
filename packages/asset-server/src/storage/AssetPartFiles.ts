// Import Internal Dependencies
import { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";
import { ASSET_PART_ID_PATTERN } from "../model/events/AssetEvents.schema.ts";

// CONSTANTS
const kPartsSuffix = ".parts";

export interface AssetPartFile {
  readonly assetPath: string;
  readonly partId: string;
}

export class AssetPartFiles {
  #kinds: AssetKindRegistry;

  constructor(
    kinds: AssetKindRegistry = new AssetKindRegistry()
  ) {
    this.#kinds = kinds;
  }

  extension(
    kind: string
  ): string | null {
    if (!this.#kinds.has(kind)) {
      return null;
    }

    const { parts } = this.#kinds.get(kind);

    return parts === undefined ? null : Object.keys(parts.extension)[0] ?? null;
  }

  folder(
    assetPath: string
  ): string {
    return `${assetPath}${kPartsSuffix}`;
  }

  path(
    assetPath: string,
    extension: string,
    partId: string
  ): string {
    return `${this.folder(assetPath)}/${partId}${extension}`;
  }

  owner(
    path: string
  ): string | null {
    const segments = path.split("/");
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (!segment.endsWith(kPartsSuffix)) {
        continue;
      }

      const assetPath = [
        ...segments.slice(0, index),
        segment.slice(0, -kPartsSuffix.length)
      ].join("/");
      if (this.extension(this.#kinds.resolve(assetPath).kind) !== null) {
        return assetPath;
      }
    }

    return null;
  }

  part(
    path: string
  ): AssetPartFile | null {
    const assetPath = this.owner(path);
    if (assetPath === null) {
      return null;
    }

    const extension = this.extension(this.#kinds.resolve(assetPath).kind);
    const name = path.slice(this.folder(assetPath).length + 1);
    if (extension === null || !name.endsWith(extension)) {
      return null;
    }

    const partId = name.slice(0, -extension.length);

    return ASSET_PART_ID_PATTERN.test(partId) ?
      { assetPath, partId } :
      null;
  }
}
