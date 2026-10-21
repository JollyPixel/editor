// Import Third-party Dependencies
import {
  SchemaParser,
  type Infer
} from "@jolly-pixel/network";
import {
  writeJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  backupEntrySchema,
  backupLedgerSchema
} from "./AssetBackups.schema.ts";
import {
  silentLogger,
  type Logger
} from "../common/logger.ts";
import {
  BACKUP_LEDGER_PATH,
  BACKUP_OBJECTS_PATH
} from "./stateDirectory.ts";
import { contentHash } from "../common/contentHash.ts";
import { TaskChain } from "../common/TaskChain.ts";
import type { Without } from "../common/types.ts";
import {
  keepValid,
  readStateFile,
  type StateFileParse
} from "./stateFile.ts";

// CONSTANTS
const kLedgerVersion = 1;
const kLedgerParser = new SchemaParser(backupLedgerSchema);
const kEntryParser = new SchemaParser(backupEntrySchema);

export type BackupEntry = Infer<typeof backupEntrySchema>;
export type BackupInput = Without<BackupEntry, "hash" | "size" | "createdAt">;

interface BackupLedgerData {
  readonly version: typeof kLedgerVersion;
  readonly entries: BackupEntry[];
}

export class AssetBackups {
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

  async add(
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
        AssetBackups.parse,
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
    const ledger = kLedgerParser.parse(input);
    if (!ledger.ok) {
      return {
        data: [],
        dropped: 0
      };
    }

    const { entries, dropped } = keepValid(
      ledger.val.entries.entries(),
      kEntryParser
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
  return `${BACKUP_OBJECTS_PATH}/${hash.slice(0, 2)}/${hash.slice(2)}`;
}
