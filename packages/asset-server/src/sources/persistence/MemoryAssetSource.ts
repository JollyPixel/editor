// Import Internal Dependencies
import type { AssetSource } from "../AssetSource.ts";
import { normalizeAssetPath } from "../paths.ts";
import { STATE_DIRECTORY } from "../../constants.ts";

export class MemoryAssetSource implements AssetSource {
  #files = new Map<string, Uint8Array>();

  constructor(
    files: Iterable<readonly [string, Uint8Array]> = []
  ) {
    for (const [path, data] of files) {
      this.#files.set(normalizeAssetPath(path), Uint8Array.from(data));
    }
  }

  async read(
    path: string
  ): Promise<Uint8Array> {
    const key = normalizeAssetPath(path);
    const data = this.#files.get(key);
    if (data === undefined) {
      throw Object.assign(
        new Error(`ENOENT: no such asset, read "${key}"`),
        { code: "ENOENT" }
      );
    }

    return Uint8Array.from(data);
  }

  async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    this.#files.set(
      normalizeAssetPath(path),
      Uint8Array.from(data)
    );
  }

  async delete(
    path: string
  ): Promise<void> {
    this.#files.delete(normalizeAssetPath(path));
  }

  async list(): Promise<string[]> {
    return [...this.#files.keys()]
      .filter((path) => !path.startsWith(`${STATE_DIRECTORY}/`))
      .sort();
  }
}
