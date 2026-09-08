// Import Third-party Dependencies
import {
  defineSchema,
  Validator,
  type Infer
} from "ata-validator";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  readJsonFile,
  writeJsonFile
} from "../sources/jsonFile.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { IDENTITY_SIDECAR_PATH } from "../constants.ts";

// CONSTANTS
const kSidecarVersion = 1;
const kValidatorOptions = { useDefaults: false };
const kEntrySchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    path: { type: "string" },
    kind: { type: "string" }
  },
  required: [
    "id",
    "path",
    "kind"
  ]
});
const kEntryValidator = new Validator(kEntrySchema, kValidatorOptions);
const kDocumentValidator = new Validator(
  defineSchema({
    type: "object",
    properties: {
      assets: { type: "array" }
    },
    required: ["assets"]
  }),
  kValidatorOptions
);

export type IdentityEntry = Readonly<Infer<typeof kEntrySchema>>;

export interface CatalogIdentitySidecarParse {
  readonly sidecar: CatalogIdentitySidecar;
  readonly dropped: number;
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

  static async load(
    source: AssetSource,
    logger: Logger = silentLogger()
  ): Promise<CatalogIdentitySidecar> {
    const { sidecar, dropped } = CatalogIdentitySidecar.parse(
      await readJsonFile(
        source,
        IDENTITY_SIDECAR_PATH
      )
    );
    if (dropped > 0) {
      logger
        .withMetadata({
          path: IDENTITY_SIDECAR_PATH,
          dropped
        })
        .warn("identity sidecar entries dropped");
    }

    return sidecar;
  }

  static parse(
    input: unknown
  ): CatalogIdentitySidecarParse {
    const document = kDocumentValidator.validate(input);
    if (!document.valid) {
      return {
        sidecar: new CatalogIdentitySidecar(),
        dropped: 0
      };
    }

    const entries: IdentityEntry[] = [];
    let dropped = 0;

    for (const asset of document.data.assets) {
      const entry = kEntryValidator.validate(asset);
      if (entry.valid) {
        entries.push(entry.data);
      }
      else {
        dropped += 1;
      }
    }

    return {
      sidecar: new CatalogIdentitySidecar(entries),
      dropped
    };
  }
}
