// Import Third-party Dependencies
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";
import { Validator } from "ata-validator";
import {
  writeJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import {
  BACKUP_LEDGER_PATH,
  CONTENT_OBJECTS_PATH
} from "../stateDirectory.ts";
import { contentHash } from "../utils/contentHash.ts";
import { TaskChain } from "../utils/TaskChain.ts";
import type { Without } from "../utils/Without.ts";
import {
  keepValid,
  readStateFile,
  type StateFileParse
} from "../utils/stateFile.ts";

// CONSTANTS
const kLedgerVersion = 1;
const kValidatorOptions = { useDefaults: false };
const kString = { type: "string" } as const;
const kBackupProperties = {
  hash: kString,
  size: {
    type: "integer",
    minimum: 0
  },
  assetId: kString,
  path: kString,
  createdAt: kString
} as const;
const kBackupRequired = [
  "hash",
  "size",
  "assetId",
  "path",
  "createdAt",
  "reason"
] as const;

const kBackupEntrySchema = defineSchema({
  oneOf: [
    {
      type: "object",
      properties: {
        ...kBackupProperties,
        reason: { const: "tag" },
        tag: {
          type: "object",
          properties: {
            name: kString,
            message: kString
          },
          required: ["name"]
        }
      },
      required: [...kBackupRequired, "tag"]
    },
    {
      type: "object",
      properties: {
        ...kBackupProperties,
        reason: { const: "external-edit" }
      },
      required: kBackupRequired
    }
  ]
});

const kLedgerValidator = new Validator(
  defineSchema({
    type: "object",
    properties: {
      entries: { type: "array" }
    },
    required: ["entries"]
  }),
  kValidatorOptions
);
const kEntryValidator = new Validator(
  kBackupEntrySchema,
  kValidatorOptions
);

export type BackupEntry = Infer<typeof kBackupEntrySchema>;
export type BackupInput = Without<BackupEntry, "hash" | "size" | "createdAt">;

interface BackupLedgerData {
  readonly version: typeof kLedgerVersion;
  readonly entries: BackupEntry[];
}

export class ContentObjects {
  #source: AssetSource;
  #logger: Logger;
  #entries: BackupEntry[] | null = null;
  #writes = new TaskChain();

  constructor(
    source: AssetSource,
    logger: Logger = silentLogger()
  ) {
    this.#source = source;
    this.#logger = logger;
  }

  async store(
    data: Uint8Array,
    input: BackupInput
  ): Promise<BackupEntry> {
    const hash = await contentHash(data);
    await this.#source.writeIfAbsent(objectPath(hash), data);

    const entry: BackupEntry = {
      ...input,
      hash,
      size: data.byteLength,
      createdAt: new Date().toISOString()
    };
    await this.#writes.run(async() => {
      this.#entries ??= await readStateFile(
        this.#source,
        BACKUP_LEDGER_PATH,
        ContentObjects.parse,
        this.#logger
      );
      this.#entries.push(entry);

      const ledger: BackupLedgerData = {
        version: kLedgerVersion,
        entries: this.#entries
      };
      await writeJsonFile(this.#source, BACKUP_LEDGER_PATH, ledger);
    });

    return entry;
  }

  static parse(
    input: unknown
  ): StateFileParse<BackupEntry[]> {
    if (!kLedgerValidator.isValidObject(input)) {
      return {
        data: [],
        dropped: 0
      };
    }

    const { entries, dropped } = keepValid(
      input.entries.entries(),
      kEntryValidator
    );

    return {
      data: entries.map(([, entry]) => entry),
      dropped
    };
  }
}

function objectPath(
  hash: string
): string {
  return `${CONTENT_OBJECTS_PATH}/${hash.slice(0, 2)}/${hash.slice(2)}`;
}
