// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import { AtomicFile } from "@openally/atomic-fs";

// Import Internal Dependencies
import type {
  AssetEntryType,
  AssetSource,
  AssetWatchOptions
} from "../../AssetSource.ts";
import { AssetPathNotFoundError } from "../../errors/AssetPathNotFoundError.ts";
import { FilesystemAssetWatcher } from "./FilesystemAssetWatcher.ts";
import { FilesystemTree } from "./FilesystemTree.ts";

// CONSTANTS
const kMissingCodes = new Set([
  "ENOENT",
  "EISDIR",
  "ENOTDIR"
]);
const kIgnoredRmdirCodes = new Set([
  "ENOENT",
  "ENOTEMPTY",
  "EEXIST"
]);

export interface FilesystemAssetSourceOptions {
  /**
   * Extra ignore globs, matched against root-relative POSIX paths.
   * Merged with DEFAULT_IGNORED_PATHS.
   */
  ignore?: readonly string[];
}

export class FilesystemAssetSource implements AssetSource {
  readonly root: string;

  #atomic = new AtomicFile({ mkdir: true });
  #tree: FilesystemTree;

  constructor(
    root: string,
    options: FilesystemAssetSourceOptions = {}
  ) {
    this.#tree = new FilesystemTree(root, {
      ignore: options.ignore,
      isTemporary: this.#atomic.isTemporary
    });
    this.root = this.#tree.root;
  }

  isIgnored(
    assetPath: string
  ): boolean {
    return this.#tree.isIgnored(assetPath);
  }

  async read(
    assetPath: string
  ): Promise<Uint8Array> {
    const absolute = await this.#tree.contain(assetPath);
    try {
      const buffer = await fs.readFile(absolute);

      return new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      );
    }
    catch (error: any) {
      if (kMissingCodes.has(error.code)) {
        throw new AssetPathNotFoundError(assetPath, { cause: error });
      }

      throw error;
    }
  }

  async exists(
    assetPath: string
  ): Promise<boolean> {
    const absolute = await this.#tree.contain(assetPath);
    try {
      const stats = await fs.stat(absolute);

      return stats.isFile();
    }
    catch (error: any) {
      if (kMissingCodes.has(error.code)) {
        return false;
      }

      throw error;
    }
  }

  async write(
    assetPath: string,
    data: Uint8Array
  ): Promise<void> {
    await this.#atomic.write(
      await this.#tree.contain(assetPath),
      data
    );
  }

  async writeIfAbsent(
    assetPath: string,
    data: Uint8Array
  ): Promise<boolean> {
    return this.#atomic.writeIfAbsent(
      await this.#tree.contain(assetPath),
      data
    );
  }

  async delete(
    assetPath: string
  ): Promise<void> {
    await fs.rm(
      await this.#tree.contain(assetPath),
      { force: true }
    );
  }

  async list(): Promise<string[]> {
    const files: string[] = [];
    for await (const file of this.#tree.files()) {
      files.push(file);
    }

    return files.sort();
  }

  async folders(): Promise<string[]> {
    const folders: string[] = [];
    for await (const folder of this.#tree.folders()) {
      folders.push(folder);
    }

    return folders.sort();
  }

  async createFolder(
    assetPath: string
  ): Promise<void> {
    await fs.mkdir(
      await this.#tree.contain(assetPath),
      { recursive: true }
    );
  }

  async deleteFolder(
    assetPath: string
  ): Promise<void> {
    const folder = await this.#tree.contain(assetPath);
    const nested = await this.#tree.subdirectoriesDeepestFirst(folder);
    for (const directory of [...nested, folder]) {
      await removeEmptyDirectory(directory);
    }
  }

  watch(
    onChange: (
      path: string,
      type: AssetEntryType
    ) => void,
    options: AssetWatchOptions = {}
  ): () => void {
    const watcher = new FilesystemAssetWatcher(
      this.#tree,
      onChange,
      options
    );

    return () => watcher.close();
  }
}

async function removeEmptyDirectory(
  directory: string
): Promise<void> {
  try {
    await fs.rmdir(directory);
  }
  catch (error: any) {
    if (!kIgnoredRmdirCodes.has(error.code)) {
      throw error;
    }
  }
}
