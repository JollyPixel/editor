// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { containedPath } from "@openally/servo";

// Import Internal Dependencies
import { AssetPathEscapeError } from "../../errors/AssetPathEscapeError.ts";
import { normalizeAssetPath } from "../../paths/index.ts";

export class FilesystemPathResolver {
  readonly root: string;

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
    const relative = normalizeAssetPath(assetPath);
    if (await containedPath(this.root, relative) === null) {
      throw new AssetPathEscapeError(assetPath);
    }

    return path.join(this.root, relative);
  }
}
