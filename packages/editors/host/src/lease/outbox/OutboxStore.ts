// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network/client";

// CONSTANTS
const kDatabaseName = "jolly-pixel:pending-changes";
const kDatabaseVersion = 2;
const kStoreName = "commands";
const kRefIndex = "ref";

interface OutboxRecord {
  id?: IDBValidKey;
  ref?: string;
  room: string;
  owner: string;
  command: NetworkCommandHeader;
}

export interface KeptCommand {
  ref: string;
  command: NetworkCommandHeader;
}

export interface OutboxStoreOptions {
  indexedDB: IDBFactory;
  owner: string;
}

export class OutboxStore {
  static async open(
    options: OutboxStoreOptions
  ): Promise<OutboxStore> {
    const request = options.indexedDB.open(kDatabaseName, kDatabaseVersion);
    request.onupgradeneeded = (event) => {
      const store = event.oldVersion === 0 ?
        request.result.createObjectStore(kStoreName, {
          keyPath: "id",
          autoIncrement: true
        }) :
        request.transaction?.objectStore(kStoreName);
      store?.createIndex(kRefIndex, "ref", { unique: true });
    };

    return new OutboxStore(
      await settled(request),
      options.owner
    );
  }

  readonly #database: IDBDatabase;
  readonly #owner: string;
  #closed = false;
  #written: Promise<void> = Promise.resolve();

  constructor(
    database: IDBDatabase,
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
    const transaction = this.#database.transaction(kStoreName, "readwrite");
    const claimed = new Map<string, KeptCommand[]>();
    const cursor = transaction.objectStore(kStoreName).openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current === null) {
        return;
      }

      const record: OutboxRecord = current.value;
      if (!liveOwners.has(record.owner)) {
        const ref = record.ref ?? crypto.randomUUID();
        current.update({
          ...record,
          ref,
          owner: this.#owner
        });
        const kept = claimed.get(record.room) ?? [];
        kept.push({
          ref,
          command: record.command
        });
        claimed.set(record.room, kept);
      }
      current.continue();
    };
    await committed(transaction);

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
    this.#write((store) => {
      const lookup = store.index(kRefIndex).getKey(kept.ref);
      lookup.onsuccess = () => {
        store.put(lookup.result === undefined ? record : {
          ...record,
          id: lookup.result
        });
      };
    });
  }

  drop(
    ref: string
  ): void {
    this.#write((store) => {
      const lookup = store.index(kRefIndex).getKey(ref);
      lookup.onsuccess = () => {
        if (lookup.result !== undefined) {
          store.delete(lookup.result);
        }
      };
    });
  }

  async close(): Promise<void> {
    this.#close();
    await this.#written;
  }

  #write(
    operation: (store: IDBObjectStore) => void
  ): void {
    if (this.#closed) {
      return;
    }

    const transaction = this.#database.transaction(kStoreName, "readwrite");
    operation(transaction.objectStore(kStoreName));
    this.#written = committed(transaction).catch(() => undefined);
  }

  #close(): void {
    this.#closed = true;
    this.#database.close();
  }
}

function settled<T>(
  request: IDBRequest<T>
): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);

  return promise;
}

function committed(
  transaction: IDBTransaction
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);

  return promise;
}
