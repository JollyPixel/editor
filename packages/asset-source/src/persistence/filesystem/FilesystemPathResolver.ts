// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { AssetPathEscapeError } from "../../errors/AssetPathEscapeError.ts";
import {
  normalizeAssetPath,
  toRelativePosix
} from "../../paths.ts";

export class FilesystemPathResolver {
  readonly root: string;

  #realRoot: Promise<string> | null = null;

  constructor(
    root: string
  ) {
    this.root = path.resolve(root);
  }

  resolve(
    assetPath: string
  ): string {
    return path.join(
      this.root,
      normalizeAssetPath(assetPath)
    );
  }

  async contained(
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
