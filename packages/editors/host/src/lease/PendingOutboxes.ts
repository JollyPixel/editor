// Import Third-party Dependencies
import type {
  ChangeOutbox,
  NetworkCommandHeader
} from "@jolly-pixel/network/client";

// CONSTANTS
const kDatabaseName = "jolly-pixel:pending-changes";
const kStoreName = "commands";
const kOwnerLockPrefix = "jolly-pixel:pending-changes:";

interface OutboxRecord {
  id?: IDBValidKey;
  room: string;
  owner: string;
  command: NetworkCommandHeader;
}

export interface PendingOutboxesOptions {
  /**
   * @default globalThis.indexedDB
   */
  indexedDB?: IDBFactory;
  /**
   * @default globalThis.navigator.locks
   */
  locks?: LockManager;
}

interface ClaimedOutboxes {
  owner: string;
  database: IDBDatabase;
  claimed: Map<string, OutboxRecord[]>;
  release: () => void;
}

export class PendingOutboxes {
  static async open(
    options: PendingOutboxesOptions = {}
  ): Promise<PendingOutboxes | null> {
    const {
      indexedDB = globalThis.indexedDB,
      locks = globalThis.navigator?.locks
    } = options;
    if (indexedDB === undefined || locks === undefined) {
      return null;
    }

    const owner = crypto.randomUUID();
    const held = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    locks.request(kOwnerLockPrefix + owner, () => {
      held.resolve();

      return release.promise;
    }).catch(held.reject);

    let database: IDBDatabase | null = null;
    try {
      await held.promise;
      database = await openDatabase(indexedDB);
      const live = await liveOwners(locks);

      return new PendingOutboxes({
        owner,
        database,
        claimed: await claimRecords(database, owner, live),
        release: release.resolve
      });
    }
    catch {
      database?.close();
      release.resolve();

      return null;
    }
  }

  readonly #owner: string;
  readonly #database: IDBDatabase;
  readonly #claimed: Map<string, OutboxRecord[]>;
  readonly #release: () => void;
  readonly #rooms = new Map<string, RoomOutbox>();

  constructor(
    options: ClaimedOutboxes
  ) {
    this.#owner = options.owner;
    this.#database = options.database;
    this.#claimed = options.claimed;
    this.#release = options.release;
  }

  open(
    room: string
  ): ChangeOutbox {
    let outbox = this.#rooms.get(room);
    if (outbox === undefined) {
      outbox = new RoomOutbox({
        room,
        owner: this.#owner,
        database: this.#database,
        records: this.#claimed.get(room) ?? []
      });
      this.#claimed.delete(room);
      this.#rooms.set(room, outbox);
    }

    return outbox;
  }

  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.#rooms.values(), (outbox) => outbox.idle())
    );
    this.#release();
    this.#database.close();
  }
}

interface RoomOutboxOptions {
  room: string;
  owner: string;
  database: IDBDatabase;
  records: readonly OutboxRecord[];
}

class RoomOutbox implements ChangeOutbox {
  readonly #room: string;
  readonly #owner: string;
  readonly #database: IDBDatabase;
  readonly #keys = new Map<NetworkCommandHeader, Promise<IDBValidKey>>();
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    options: RoomOutboxOptions
  ) {
    this.#room = options.room;
    this.#owner = options.owner;
    this.#database = options.database;
    for (const { id, command } of options.records) {
      if (id !== undefined) {
        this.#keys.set(command, Promise.resolve(id));
      }
    }
  }

  restore(): NetworkCommandHeader[] {
    return [...this.#keys.keys()];
  }

  keep(
    command: NetworkCommandHeader
  ): void {
    const record: OutboxRecord = {
      room: this.#room,
      owner: this.#owner,
      command: structuredClone(command)
    };
    const previous = this.#keys.get(command);
    const written = this.#enqueue(async() => {
      const id = await previous?.catch(() => undefined);
      const store = transactionStore(this.#database);
      const request = id === undefined ?
        store.add(record) :
        store.put({ ...record, id });
      await committed(store.transaction);

      return request.result;
    });
    written.catch(() => undefined);
    this.#keys.set(command, written);
  }

  drop(
    command: NetworkCommandHeader
  ): void {
    const key = this.#keys.get(command);
    if (key === undefined) {
      return;
    }

    this.#keys.delete(command);
    this.#enqueue(async() => {
      const id = await key;
      const store = transactionStore(this.#database);
      store.delete(id);

      return committed(store.transaction);
    }).catch(() => undefined);
  }

  idle(): Promise<unknown> {
    return this.#queue;
  }

  #enqueue<T>(
    task: () => Promise<T>
  ): Promise<T> {
    const next = this.#queue.then(task);
    this.#queue = next.catch(() => undefined);

    return next;
  }
}

function openDatabase(
  indexedDB: IDBFactory
): Promise<IDBDatabase> {
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
  const request = indexedDB.open(kDatabaseName, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(kStoreName, {
      keyPath: "id",
      autoIncrement: true
    });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);

  return promise;
}

async function liveOwners(
  locks: LockManager
): Promise<Set<string>> {
  const { held = [] } = await locks.query();

  return new Set(
    held.flatMap(({ name }) => (
      name?.startsWith(kOwnerLockPrefix) ?
        [name.slice(kOwnerLockPrefix.length)] :
        []
    ))
  );
}

async function claimRecords(
  database: IDBDatabase,
  owner: string,
  live: ReadonlySet<string>
): Promise<Map<string, OutboxRecord[]>> {
  const store = transactionStore(database);
  const claimed = new Map<string, OutboxRecord[]>();
  const cursor = store.openCursor();
  cursor.onsuccess = () => {
    const current = cursor.result;
    if (current === null) {
      return;
    }

    const record: OutboxRecord = current.value;
    if (!live.has(record.owner)) {
      const owned: OutboxRecord = {
        ...record,
        owner
      };
      current.update(owned);
      const records = claimed.get(record.room) ?? [];
      records.push(owned);
      claimed.set(record.room, records);
    }
    current.continue();
  };
  await committed(store.transaction);

  return claimed;
}

function transactionStore(
  database: IDBDatabase
): IDBObjectStore {
  return database
    .transaction(kStoreName, "readwrite")
    .objectStore(kStoreName);
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
