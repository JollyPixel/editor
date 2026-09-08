// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import { FilesystemAssetWatcher } from "./FilesystemAssetWatcher.ts";
import { FilesystemPathResolver } from "./FilesystemPathResolver.ts";
import {
  createIgnoredPathMatcher,
  type AssetPathMatcher
} from "./ignoredPaths.ts";
import { listFiles } from "./listFiles.ts";
import { writeFileAtomically } from "./writeFileAtomically.ts";

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

  async write(
    assetPath: string,
    data: Uint8Array
  ): Promise<void> {
    await writeFileAtomically(
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

  list(): Promise<string[]> {
    return listFiles(
      this.root,
      this.#isIgnored
    );
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
