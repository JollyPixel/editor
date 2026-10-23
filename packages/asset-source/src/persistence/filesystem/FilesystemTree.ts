// Import Node.js Dependencies
import fs from "node:fs/promises";
import type { Dir } from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import { containedPath } from "@openally/servo";

// Import Internal Dependencies
import type { AssetEntryType } from "../../AssetSource.ts";
import { AssetPathEscapeError } from "../../errors/AssetPathEscapeError.ts";
import { normalizeAssetPath } from "../../paths/index.ts";
import {
  createIgnoredPathMatcher,
  type AssetPathMatcher
} from "./ignoredPaths.ts";

export interface FilesystemTreeOptions {
  ignore?: readonly string[];
  isTemporary: (name: string) => boolean;
}

interface TreeEntry {
  path: string;
  type: AssetEntryType;
}

export class FilesystemTree {
  readonly root: string;

  #isIgnored: AssetPathMatcher;
  #isTemporary: (name: string) => boolean;

  constructor(
    root: string,
    options: FilesystemTreeOptions
  ) {
    const {
      ignore = [],
      isTemporary
    } = options;

    this.root = path.resolve(root);
    this.#isIgnored = createIgnoredPathMatcher(ignore);
    this.#isTemporary = isTemporary;
  }

  isIgnored(
    assetPath: string
  ): boolean {
    return this.#isIgnored(assetPath);
  }

  async contain(
    assetPath: string
  ): Promise<string> {
    const relative = normalizeAssetPath(assetPath);
    if (await containedPath(this.root, relative) === null) {
      throw new AssetPathEscapeError(assetPath);
    }

    return path.join(this.root, relative);
  }

  excludes(
    absolute: string
  ): boolean {
    const relative = this.#relative(absolute);

    return relative !== null && this.#isIgnored(relative);
  }

  assetPath(
    absolute: string,
    type: AssetEntryType
  ): string | null {
    const relative = this.#relative(absolute);
    if (
      relative === null ||
      this.#isIgnored(relative) ||
      (type === "file" && this.#isTemporary(path.basename(absolute)))
    ) {
      return null;
    }

    return relative;
  }

  async subdirectoriesDeepestFirst(
    absolute: string
  ): Promise<string[]> {
    try {
      const entries = await fs.readdir(absolute, {
        recursive: true,
        withFileTypes: true
      });

      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(entry.parentPath, entry.name))
        .sort((left, right) => right.length - left.length);
    }
    catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  async* files(): AsyncIterableIterator<string> {
    for await (const entry of this.#entries()) {
      if (entry.type === "file") {
        yield entry.path;
      }
    }
  }

  async* folders(): AsyncIterableIterator<string> {
    for await (const entry of this.#entries()) {
      if (entry.type === "folder") {
        yield entry.path;
      }
    }
  }

  async* #entries(): AsyncIterableIterator<TreeEntry> {
    const directory = await openRoot(this.root);
    if (directory !== null) {
      yield* this.#walk(directory);
    }
  }

  async* #walk(
    directory: Dir
  ): AsyncIterableIterator<TreeEntry> {
    for await (const dirent of directory) {
      const absolute = path.join(directory.path, dirent.name);
      if (dirent.isDirectory()) {
        const folder = this.assetPath(absolute, "folder");
        if (folder !== null) {
          yield {
            path: folder,
            type: "folder"
          };
          yield* this.#walk(
            await fs.opendir(absolute)
          );
        }
      }
      else if (dirent.isFile()) {
        const file = this.assetPath(absolute, "file");
        if (file !== null) {
          yield {
            path: file,
            type: "file"
          };
        }
      }
    }
  }

  #relative(
    absolute: string
  ): string | null {
    const relative = path.relative(this.root, absolute);
    if (
      relative.length === 0 ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return null;
    }

    return relative.replaceAll("\\", "/");
  }
}

async function openRoot(
  root: string
): Promise<Dir | null> {
  try {
    return await fs.opendir(root);
  }
  catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
