// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  readJsonFile,
  writeJsonFile
} from "../sources/jsonFile.ts";
import { IDENTITY_SIDECAR_PATH } from "../constants.ts";

// CONSTANTS
const kSidecarVersion = 1;

export interface IdentityEntry {
  readonly id: string;
  readonly path: string;
  readonly kind: string;
}

export interface CatalogIdentitySidecarData {
  readonly version: 1;
  readonly assets: readonly IdentityEntry[];
}

/**
 * Persists path-to-AssetId mappings beside the workspace.
 *
 * The committed half of the catalog: {@link CatalogProjection} is replayed
 * from the event log and can always be rebuilt, while this file is the only
 * record that survives a clone, since the log itself is never committed.
 *
 * An unreadable sidecar loses ids, not event data.
 */
export class CatalogIdentitySidecar {
  #byPath = new Map<string, IdentityEntry>();
  #byId = new Map<string, IdentityEntry>();

  constructor(
    entries: Iterable<IdentityEntry> = []
  ) {
    for (const entry of entries) {
      this.set(entry);
    }
  }

  get size(): number {
    return this.#byPath.size;
  }

  /**
   * Binds one id to one path and evicts conflicts from both indexes.
   */
  set(
    entry: IdentityEntry
  ): this {
    const previousPath = this.#byId.get(entry.id);
    if (previousPath !== undefined) {
      this.#byPath.delete(previousPath.path);
    }

    const previousId = this.#byPath.get(entry.path);
    if (previousId !== undefined) {
      this.#byId.delete(previousId.id);
    }

    const stored: IdentityEntry = {
      id: entry.id,
      path: entry.path,
      kind: entry.kind
    };
    this.#byPath.set(stored.path, stored);
    this.#byId.set(stored.id, stored);

    return this;
  }

  removeById(
    id: string
  ): boolean {
    const entry = this.#byId.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#byId.delete(id);
    this.#byPath.delete(entry.path);

    return true;
  }

  byPath(
    path: string
  ): IdentityEntry | undefined {
    return this.#byPath.get(path);
  }

  byId(
    id: string
  ): IdentityEntry | undefined {
    return this.#byId.get(id);
  }

  [Symbol.iterator](): IterableIterator<IdentityEntry> {
    return this.#byId.values();
  }

  toJSON(): CatalogIdentitySidecarData {
    return {
      version: kSidecarVersion,
      assets: [...this.#byId.values()].sort(
        (a, b) => a.path.localeCompare(b.path)
      )
    };
  }

  save(
    source: AssetSource
  ): Promise<void> {
    return writeJsonFile(
      source,
      IDENTITY_SIDECAR_PATH,
      this.toJSON()
    );
  }

  /**
   * Reads the sidecar, returning an empty instance when it is missing,
   * unreadable or malformed.
   */
  static async load(
    source: AssetSource
  ): Promise<CatalogIdentitySidecar> {
    return CatalogIdentitySidecar.parse(
      await readJsonFile(
        source,
        IDENTITY_SIDECAR_PATH
      )
    );
  }

  static parse(
    input: unknown
  ): CatalogIdentitySidecar {
    if (
      typeof input !== "object" ||
      input === null ||
      !("assets" in input) ||
      !Array.isArray(input.assets)
    ) {
      return new CatalogIdentitySidecar();
    }

    return new CatalogIdentitySidecar(
      input.assets.filter(isIdentityEntry)
    );
  }
}

function isIdentityEntry(
  input: unknown
): input is IdentityEntry {
  return typeof input === "object" &&
    input !== null &&
    "id" in input && typeof input.id === "string" &&
    "path" in input && typeof input.path === "string" &&
    "kind" in input && typeof input.kind === "string";
}
