// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import {
  fileURLToPathExtended
} from "./utils/fileURLToPathExtended.ts";

export class FSTreeRootDirectory {
  #dir: string;

  constructor(
    dir: string | URL
  ) {
    this.#dir = fileURLToPathExtended(dir);

    if (!path.isAbsolute(this.#dir)) {
      throw new Error("Location must be an absolute path or a file URL.");
    }
  }

  get value(): string {
    return this.#dir;
  }

  normalize(
    parentPath: string
  ): string {
    return path.normalize(
      path.sep + path.relative(this.#dir, parentPath)
    );
  }
}
