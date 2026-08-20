// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Import Third-party Dependencies
import chokidar from "chokidar";
import picomatch from "picomatch";

// Import Internal Dependencies
import type { AssetSource } from "../AssetSource.ts";
import {
  normalizeAssetPath,
  toRelativePosix
} from "../paths.ts";
import { STATE_DIRECTORY } from "../../constants.ts";

export const DEFAULT_IGNORED_PATHS: readonly string[] = [
  `${STATE_DIRECTORY}/**`,
  ".git/**",
  "node_modules/**",
  "dist/**"
];

export interface FilesystemAssetSourceOptions {
  /**
   * Extra ignore globs, matched against root-relative POSIX paths.
   * Merged with DEFAULT_IGNORED_PATHS.
   */
  ignore?: readonly string[];
}

export class FilesystemAssetSource implements AssetSource {
  readonly root: string;

  #isIgnored: picomatch.Matcher;

  constructor(
    root: string,
    options: FilesystemAssetSourceOptions = {}
  ) {
    const { ignore = [] } = options;

    this.root = path.resolve(root);
    this.#isIgnored = picomatch(
      [
        ...DEFAULT_IGNORED_PATHS,
        ...ignore
      ],
      { dot: true }
    );
  }

  isIgnored(
    assetPath: string
  ): boolean {
    return this.#isIgnored(assetPath);
  }

  resolve(
    assetPath: string
  ): string {
    return path.join(
      this.root,
      normalizeAssetPath(assetPath)
    );
  }

  async read(
    assetPath: string
  ): Promise<Uint8Array> {
    const buffer = await fs.readFile(
      this.resolve(assetPath)
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
    const absolute = this.resolve(assetPath);
    const directory = path.dirname(absolute);
    await fs.mkdir(
      directory,
      { recursive: true }
    );

    const temporary = path.join(
      directory,
      `.${path.basename(absolute)}.${randomBytes(6).toString("hex")}.tmp`
    );
    try {
      await fs.writeFile(temporary, data);
      await fs.rename(temporary, absolute);
    }
    catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
  }

  async delete(
    assetPath: string
  ): Promise<void> {
    await fs.rm(
      this.resolve(assetPath),
      { force: true }
    );
  }

  async list(): Promise<string[]> {
    const entries: string[] = [];
    await this.#walk(this.root, entries);

    return entries.sort();
  }

  /**
   * Reports external changes, including the projector's own writes.
   */
  watch(
    onChange: (path: string) => void
  ): () => void {
    const watcher = chokidar.watch(this.root, {
      persistent: true,
      /**
       * Initial entries close the race between scanning and watcher readiness.
       */
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 30
      },
      ignored: (absolute: string) => {
        const relative = toRelativePosix(this.root, absolute);

        return relative !== null && this.#isIgnored(relative);
      }
    });

    const notify = (absolute: string) => {
      const relative = toRelativePosix(this.root, absolute);
      if (relative === null || this.#isIgnored(relative)) {
        return;
      }

      onChange(relative);
    };
    watcher
      .on("add", notify)
      .on("change", notify)
      .on("unlink", notify);

    return () => {
      watcher.removeAllListeners();
      void watcher.close();
    };
  }

  async #walk(
    directory: string,
    entries: string[]
  ): Promise<void> {
    const children = await fs.readdir(
      directory,
      { withFileTypes: true }
    );

    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = toRelativePosix(this.root, absolute);
      if (relative === null || this.#isIgnored(relative)) {
        continue;
      }

      if (child.isDirectory()) {
        await this.#walk(absolute, entries);
      }
      else if (child.isFile() && !isTemporary(child.name)) {
        entries.push(relative);
      }
    }
  }
}

function isTemporary(
  name: string
): boolean {
  return name.startsWith(".") && name.endsWith(".tmp");
}
