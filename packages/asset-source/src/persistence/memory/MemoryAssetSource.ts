// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import { AssetPathNotFoundError } from "../../errors/AssetPathNotFoundError.ts";
import {
  FolderSet,
  isStatePath,
  normalizeAssetPath
} from "../../paths/index.ts";

export class MemoryAssetSource implements AssetSource {
  #files = new Map<string, Uint8Array>();
  #folders = new FolderSet();

  constructor(
    files: Iterable<readonly [string, Uint8Array]> = []
  ) {
    for (const [path, data] of files) {
      this.#store(
        normalizeAssetPath(path),
        data
      );
    }
  }

  async read(
    path: string
  ): Promise<Uint8Array> {
    const key = normalizeAssetPath(path);
    const data = this.#files.get(key);
    if (data === undefined) {
      throw new AssetPathNotFoundError(key);
    }

    return Uint8Array.from(data);
  }

  async exists(
    path: string
  ): Promise<boolean> {
    return this.#files.has(
      normalizeAssetPath(path)
    );
  }

  async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    this.#store(
      normalizeAssetPath(path),
      data
    );
  }

  async writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    if (this.#files.has(key)) {
      return false;
    }

    this.#store(key, data);

    return true;
  }

  async delete(
    path: string
  ): Promise<void> {
    this.#files.delete(
      normalizeAssetPath(path)
    );
  }

  isIgnored(
    path: string
  ): boolean {
    return isStatePath(path);
  }

  async list(): Promise<string[]> {
    return [...this.#files.keys()]
      .filter((path) => !this.isIgnored(path))
      .sort();
  }

  async folders(): Promise<string[]> {
    return this.#folders
      .toJSON()
      .filter((path) => !this.isIgnored(path));
  }

  async createFolder(
    path: string
  ): Promise<void> {
    this.#folders.add(
      normalizeAssetPath(path)
    );
  }

  async deleteFolder(
    path: string
  ): Promise<void> {
    this.#folders.prune(
      normalizeAssetPath(path),
      this.#files.keys()
    );
  }

  #store(
    key: string,
    data: Uint8Array
  ): void {
    this.#files.set(
      key,
      Uint8Array.from(data)
    );
    this.#folders.addParents(key);
  }
}
