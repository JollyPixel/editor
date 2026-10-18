// Import Internal Dependencies
import type {
  Event,
  EventTag
} from "../../EventStore.ts";
import type { EventJournal } from "../EventLog.ts";
import type { MemoryEventLogOptions } from "../memory/log.ts";

// CONSTANTS
const kDatabaseVersion = 1;
const kEventsStore = "events";
const kTagsStore = "tags";

type IndexedDbStore = typeof kEventsStore | typeof kTagsStore;

export interface IndexedDbEventStoreOptions {
  name: string;
  /**
   * @default globalThis.indexedDB
   */
  factory?: IDBFactory;
}

export class IndexedDbJournal implements EventJournal {
  static async open(
    options: IndexedDbEventStoreOptions
  ): Promise<IndexedDbJournal> {
    const {
      name,
      factory = globalThis.indexedDB
    } = options;

    const request = factory.open(name, kDatabaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(kEventsStore)) {
        database.createObjectStore(kEventsStore, { keyPath: "eventId" });
      }
      if (!database.objectStoreNames.contains(kTagsStore)) {
        database.createObjectStore(kTagsStore, {
          keyPath: ["assetId", "name"]
        });
      }
    };

    return new IndexedDbJournal(await settled(request));
  }

  static async destroy(
    options: IndexedDbEventStoreOptions
  ): Promise<void> {
    const {
      name,
      factory = globalThis.indexedDB
    } = options;

    await settled(factory.deleteDatabase(name));
  }

  #database: IDBDatabase;
  #failure: Error | null = null;

  constructor(
    database: IDBDatabase
  ) {
    this.#database = database;
    database.onversionchange = () => database.close();
  }

  async load(): Promise<MemoryEventLogOptions> {
    const transaction = this.#database.transaction(
      [kEventsStore, kTagsStore],
      "readonly"
    );
    const [events, tags] = await Promise.all([
      settled<Event[]>(transaction.objectStore(kEventsStore).getAll()),
      settled<EventTag[]>(transaction.objectStore(kTagsStore).getAll())
    ]);

    return {
      events,
      tags
    };
  }

  putEvent(
    event: Event
  ): void {
    this.#writable(kEventsStore).put(event);
  }

  deleteEvents(
    events: Iterable<Event>
  ): void {
    const store = this.#writable(kEventsStore);
    for (const event of events) {
      store.delete(event.eventId);
    }
  }

  putTag(
    tag: EventTag
  ): void {
    this.#writable(kTagsStore).put(tag);
  }

  deleteTag(
    assetId: string,
    name: string
  ): void {
    this.#writable(kTagsStore).delete([assetId, name]);
  }

  close(): void {
    this.#database.close();
  }

  #writable(
    store: IndexedDbStore
  ): IDBObjectStore {
    if (this.#failure !== null) {
      throw this.#failure;
    }

    const transaction = this.#database.transaction(store, "readwrite");
    transaction.onabort = () => {
      this.#failure ??= transaction.error ??
        new Error(`IndexedDB write to "${store}" was aborted`);
    };

    return transaction.objectStore(store);
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
