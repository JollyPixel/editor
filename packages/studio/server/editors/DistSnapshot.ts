// Import Node.js Dependencies
import {
  readdirSync,
  statSync
} from "node:fs";
import path from "node:path";

export class DistSnapshot {
  #root: string;
  #entries = new Map<string, string>();

  constructor(
    root: string
  ) {
    this.#root = root;
    this.#record(root);
  }

  update(
    file: string
  ): boolean {
    const key = path.normalize(file);
    const stats = statSync(
      path.join(this.#root, key),
      { throwIfNoEntry: false }
    );
    if (stats === undefined) {
      return this.#entries.delete(key);
    }

    const previous = this.#entries.get(key);
    const fingerprint = stats.isDirectory() ?
      "directory" :
      `${stats.mtimeMs}:${stats.size}`;
    this.#entries.set(key, fingerprint);

    return previous !== fingerprint;
  }

  #record(
    directory: string
  ): void {
    const dirent = readdirSync(
      directory,
      { withFileTypes: true }
    );

    for (const entry of dirent) {
      const file = path.join(directory, entry.name);
      this.update(
        path.relative(this.#root, file)
      );

      if (entry.isDirectory()) {
        this.#record(file);
      }
    }
  }
}
