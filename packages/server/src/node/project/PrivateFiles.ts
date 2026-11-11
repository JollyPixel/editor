// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";

// CONSTANTS
const kGlobSyntax = /[\\*?[\]{}()!+@|]/g;

export class PrivateFiles implements Iterable<string> {
  #globs: readonly string[];

  constructor(
    root: string,
    extensions: Iterable<string>
  ) {
    const base = literalGlob(
      path.resolve(root).split(path.sep).join("/")
    );

    this.#globs = [
      `**/${STATE_DIRECTORY}/**`,
      ...Array.from(
        new Set(extensions),
        (extension) => `${base}/**/*${literalGlob(extension)}`
      )
    ];
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.#globs.values();
  }
}

function literalGlob(
  value: string
): string {
  return value.replace(kGlobSyntax, "\\$&");
}
