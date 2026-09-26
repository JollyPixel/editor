// Import Third-party Dependencies
import { defineSchema } from "@jolly-pixel/network";
import {
  Validator,
  type Infer
} from "ata-validator";
import {
  writeJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { IDENTITY_SIDECAR_PATH } from "../stateDirectory.ts";
import {
  keepValid,
  readStateFile,
  type StateFileParse
} from "../utils/stateFile.ts";

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
const kEntryValidator = new Validator(
  kEntrySchema,
  kValidatorOptions
);
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

export interface IdentitySidecarData {
  readonly version: 1;
  readonly assets: readonly IdentityEntry[];
}

/**
 * Persists path-to-AssetId mappings beside the workspace.
 *
 * The event log is never committed, so this file is the only record of
 * asset ids that survives a clone. An unreadable sidecar loses ids, not
 * event data.
 */
export class IdentitySidecar {
  #source: AssetSource;
  #byPath = new Map<string, IdentityEntry>();
  #byId = new Map<string, IdentityEntry>();

  constructor(
    source: AssetSource,
    entries: Iterable<IdentityEntry> = []
  ) {
    this.#source = source;
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

  toJSON(): IdentitySidecarData {
    return {
      version: kSidecarVersion,
      assets: [...this.#byId.values()].sort(
        (left, right) => left.path.localeCompare(right.path)
      )
    };
  }

  save(): Promise<void> {
    return writeJsonFile(
      this.#source,
      IDENTITY_SIDECAR_PATH,
      this.toJSON()
    );
  }

  static async load(
    source: AssetSource,
    logger: Logger = silentLogger()
  ): Promise<IdentitySidecar> {
    const entries = await readStateFile(
      source,
      IDENTITY_SIDECAR_PATH,
      IdentitySidecar.parse,
      logger
    );

    return new IdentitySidecar(
      source,
      entries
    );
  }

  static parse(
    input: unknown
  ): StateFileParse<IdentityEntry[]> {
    const document = kDocumentValidator.validate(input);
    if (!document.valid) {
      return {
        data: [],
        dropped: 0
      };
    }

    const { entries, dropped } = keepValid(
      document.data.assets.entries(),
      kEntryValidator
    );

    return {
      data: entries.map(([, entry]) => entry),
      dropped
    };
  }
}
