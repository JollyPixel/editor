// Import Third-party Dependencies
import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPObjectStore
} from "idb";
import type { NetworkCommandHeader } from "@jolly-pixel/network/client";

// CONSTANTS
const kDatabaseName = "jolly-pixel:pending-changes";
const kDatabaseVersion = 2;

interface OutboxRecord {
  id?: number;
  ref: string;
  room: string;
  owner: string;
  command: NetworkCommandHeader;
}

interface OutboxSchema extends DBSchema {
  commands: {
    key: number;
    value: OutboxRecord;
    indexes: {
      ref: string;
    };
  };
}

type CommandStore = IDBPObjectStore<
  OutboxSchema,
  ["commands"],
  "commands",
  "readwrite"
>;

export interface KeptCommand {
  ref: string;
  command: NetworkCommandHeader;
}

export class OutboxStore {
  static async open(
    owner: string
  ): Promise<OutboxStore> {
    const database = await openDB<OutboxSchema>(
      kDatabaseName,
      kDatabaseVersion,
      {
        upgrade(database) {
          database
            .createObjectStore("commands", {
              keyPath: "id",
              autoIncrement: true
            })
            .createIndex("ref", "ref", { unique: true });
        }
      }
    );

    return new OutboxStore(database, owner);
  }

  readonly #database: IDBPDatabase<OutboxSchema>;
  readonly #owner: string;
  #closed = false;
  #written: Promise<void> = Promise.resolve();

  constructor(
    database: IDBPDatabase<OutboxSchema>,
    owner: string
  ) {
    this.#database = database;
    this.#owner = owner;
    database.onversionchange = () => this.#close();
    database.onclose = () => {
      this.#closed = true;
    };
  }

  async claim(
    liveOwners: ReadonlySet<string>
  ): Promise<Map<string, KeptCommand[]>> {
    const transaction = this.#database.transaction("commands", "readwrite");
    const claimed = new Map<string, KeptCommand[]>();
    for await (const cursor of transaction.store) {
      const record = cursor.value;
      if (!liveOwners.has(record.owner)) {
        await cursor.update({
          ...record,
          owner: this.#owner
        });
        const kept = claimed.get(record.room) ?? [];
        kept.push({
          ref: record.ref,
          command: record.command
        });
        claimed.set(record.room, kept);
      }
    }
    await transaction.done;

    return claimed;
  }

  keep(
    room: string,
    kept: KeptCommand
  ): void {
    const record: OutboxRecord = {
      ref: kept.ref,
      room,
      owner: this.#owner,
      command: kept.command
    };
    this.#write(async(store) => {
      const id = await store.index("ref").getKey(kept.ref);
      await store.put(id === undefined ? record : {
        ...record,
        id
      });
    });
  }

  drop(
    ref: string
  ): void {
    this.#write(async(store) => {
      const id = await store.index("ref").getKey(ref);
      if (id !== undefined) {
        await store.delete(id);
      }
    });
  }

  async close(): Promise<void> {
    this.#close();
    await this.#written;
  }

  #write(
    operation: (store: CommandStore) => Promise<void>
  ): void {
    if (this.#closed) {
      return;
    }

    const transaction = this.#database.transaction("commands", "readwrite");
    this.#written = Promise.all([
      operation(transaction.store),
      transaction.done
    ]).then(
      () => undefined,
      () => undefined
    );
  }

  #close(): void {
    this.#closed = true;
    this.#database.close();
  }
}
