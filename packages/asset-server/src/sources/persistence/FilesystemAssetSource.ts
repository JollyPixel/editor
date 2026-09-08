// Import Node.js Dependencies
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
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
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";
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
  #realRoot: Promise<string> | null = null;

  constructor(
    root: string,
    options: FilesystemAssetSourceOptions = {}
  ) {
    const {
      ignore = []
    } = options;

    this.root = path.resolve(root);
    this.#isIgnored = picomatch(
      [
        ...DEFAULT_IGNORED_PATHS,
        ...ignore
      ],
      {
        dot: true,
        nocase: true
      }
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
      await this.#contained(assetPath)
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
    const absolute = await this.#contained(assetPath);
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
      await fs.rm(
        temporary,
        { force: true }
      );
      throw error;
    }
  }

  async delete(
    assetPath: string
  ): Promise<void> {
    await fs.rm(
      await this.#contained(assetPath),
      { force: true }
    );
  }

  async list(): Promise<string[]> {
    const entries: string[] = [];
    await this.#walk(
      this.root,
      entries
    );

    return entries.sort();
  }

  watch(
    onChange: (path: string) => void
  ): () => void {
    const watcher = chokidar.watch(this.root, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 30
      },
      ignored: (absolute: string) => {
        const relative = toRelativePosix(
          this.root,
          absolute
        );

        return relative !== null && this.#isIgnored(relative);
      }
    });

    const notify = (absolute: string) => {
      const relative = toRelativePosix(
        this.root,
        absolute
      );
      if (
        relative === null ||
        this.#isIgnored(relative)
      ) {
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

  async #contained(
    assetPath: string
  ): Promise<string> {
    const absolute = this.resolve(assetPath);
    this.#realRoot ??= realPath(this.root)
      .catch((error) => {
        this.#realRoot = null;
        throw error;
      });

    const root = await this.#realRoot;
    const real = await realPath(absolute);
    if (
      real !== root &&
      toRelativePosix(root, real) === null
    ) {
      throw new AssetPathEscapeError(assetPath);
    }

    return absolute;
  }

  async #walk(
    directory: string,
    entries: string[]
  ): Promise<void> {
    let children: Dirent[];
    try {
      children = await fs.readdir(
        directory,
        { withFileTypes: true }
      );
    }
    catch (error) {
      if (
        isNotFound(error) &&
        directory === this.root
      ) {
        return;
      }
      throw error;
    }

    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = toRelativePosix(
        this.root,
        absolute
      );
      if (
        relative === null ||
        this.#isIgnored(relative)
      ) {
        continue;
      }

      if (child.isDirectory()) {
        await this.#walk(absolute, entries);
      }
      else if (
        child.isFile() &&
        !isTemporary(child.name)
      ) {
        entries.push(relative);
      }
    }
  }
}

async function realPath(
  absolute: string
): Promise<string> {
  try {
    return await fs.realpath(absolute);
  }
  catch (error) {
    const parent = path.dirname(absolute);
    if (
      !isNotFound(error) ||
      parent === absolute
    ) {
      throw error;
    }

    return path.join(
      await realPath(parent),
      path.basename(absolute)
    );
  }
}

function isNotFound(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}

function isTemporary(
  name: string
): boolean {
  return name.startsWith(".") && name.endsWith(".tmp");
}
