// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { AtomicFile } from "@openally/atomic-fs";

// Import Internal Dependencies
import type {
  AssetEntryType,
  AssetSource
} from "../../AssetSource.ts";
import { FilesystemAssetWatcher } from "./FilesystemAssetWatcher.ts";
import { FilesystemPathResolver } from "./FilesystemPathResolver.ts";
import {
  createIgnoredPathMatcher,
  type AssetPathMatcher
} from "./ignoredPaths.ts";
import {
  walk,
  walkFolders
} from "./walk.ts";

// CONSTANTS
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

  #isIgnored: AssetPathMatcher;
  #paths: FilesystemPathResolver;
  #atomic = new AtomicFile({ mkdir: true });

  constructor(
    root: string,
    options: FilesystemAssetSourceOptions = {}
  ) {
    const {
      ignore = []
    } = options;

    this.#paths = new FilesystemPathResolver(root);
    this.root = this.#paths.root;
    this.#isIgnored = createIgnoredPathMatcher(ignore);
  }

  isIgnored(
    assetPath: string
  ): boolean {
    return this.#isIgnored(assetPath);
  }

  resolve(
    assetPath: string
  ): string {
    return this.#paths.resolve(assetPath);
  }

  async read(
    assetPath: string
  ): Promise<Uint8Array> {
    const buffer = await fs.readFile(
      await this.#paths.contained(assetPath)
    );

    return new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
  }

  async exists(
    assetPath: string
  ): Promise<boolean> {
    try {
      await fs.access(
        await this.#paths.contained(assetPath)
      );

      return true;
    }
    catch (error: any) {
      if (
        error.code === "ENOENT" ||
        error.code === "ENOTDIR"
      ) {
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
      await this.#paths.contained(assetPath),
      data
    );
  }

  async writeIfAbsent(
    assetPath: string,
    data: Uint8Array
  ): Promise<boolean> {
    return this.#atomic.writeIfAbsent(
      await this.#paths.contained(assetPath),
      data
    );
  }

  async delete(
    assetPath: string
  ): Promise<void> {
    await fs.rm(
      await this.#paths.contained(assetPath),
      { force: true }
    );
  }

  async list(): Promise<string[]> {
    const files: string[] = [];
    const asyncIterable = walk(
      this.root,
      {
        isIgnored: this.#isIgnored,
        isTemporary: this.#atomic.isTemporary
      }
    );
    for await (const file of asyncIterable) {
      files.push(file);
    }

    return files.sort();
  }

  async folders(): Promise<string[]> {
    const folders: string[] = [];
    const asyncIterable = walkFolders(
      this.root,
      {
        isIgnored: this.#isIgnored,
        isTemporary: this.#atomic.isTemporary
      }
    );
    for await (const folder of asyncIterable) {
      folders.push(folder);
    }

    return folders.sort();
  }

  async createFolder(
    assetPath: string
  ): Promise<void> {
    await fs.mkdir(
      await this.#paths.contained(assetPath),
      { recursive: true }
    );
  }

  async deleteFolder(
    assetPath: string
  ): Promise<void> {
    const folder = await this.#paths.contained(assetPath);
    const nested: string[] = [];
    const asyncIterable = walkFolders(
      folder,
      {
        isIgnored: () => false,
        isTemporary: this.#atomic.isTemporary
      }
    );
    for await (const relative of asyncIterable) {
      nested.push(path.join(folder, relative));
    }

    for (const directory of [...nested.reverse(), folder]) {
      await removeEmptyDirectory(directory);
    }
  }

  watch(
    onChange: (
      path: string,
      type: AssetEntryType
    ) => void
  ): () => void {
    const watcher = new FilesystemAssetWatcher(
      {
        root: this.root,
        isIgnored: this.#isIgnored
      },
      onChange
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
