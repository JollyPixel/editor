// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import { AtomicFile } from "@openally/atomic-fs";

// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import { FilesystemAssetWatcher } from "./FilesystemAssetWatcher.ts";
import { FilesystemPathResolver } from "./FilesystemPathResolver.ts";
import {
  createIgnoredPathMatcher,
  type AssetPathMatcher
} from "./ignoredPaths.ts";
import { walk } from "./walk.ts";

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

  watch(
    onChange: (path: string) => void
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
