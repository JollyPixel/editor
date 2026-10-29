// Import Third-party Dependencies
import {
  deleteDB,
  openDB,
  unwrap,
  type DBSchema,
  type IDBPDatabase,
  type StoreNames
} from "idb";

// Import Internal Dependencies
import type {
  Event,
  EventTag
} from "../../EventStore.ts";
import type { EventJournal } from "../EventLog.ts";
import type { MemoryEventLogOptions } from "../memory/log.ts";

// CONSTANTS
const kDatabaseVersion = 1;

interface JournalSchema extends DBSchema {
  events: {
    key: number;
    value: Event;
  };
  tags: {
    key: [string, string];
    value: EventTag;
  };
}

export interface IndexedDbEventStoreOptions {
  name: string;
}

export class IndexedDbJournal implements EventJournal {
  static async open(
    options: IndexedDbEventStoreOptions
  ): Promise<IndexedDbJournal> {
    const database = await openDB<JournalSchema>(
      options.name,
      kDatabaseVersion,
      {
        upgrade(database) {
          database.createObjectStore("events", { keyPath: "eventId" });
          database.createObjectStore("tags", {
            keyPath: ["assetId", "name"]
          });
        }
      }
    );

    return new IndexedDbJournal(database);
  }

  static async destroy(
    options: IndexedDbEventStoreOptions
  ): Promise<void> {
    await deleteDB(options.name);
  }

  #database: IDBPDatabase<JournalSchema>;

  constructor(
    database: IDBPDatabase<JournalSchema>
  ) {
    this.#database = database;
    database.onversionchange = () => database.close();
  }

  async load(): Promise<MemoryEventLogOptions> {
    const transaction = this.#database.transaction(["events", "tags"]);
    const [events, tags] = await Promise.all([
      transaction.objectStore("events").getAll(),
      transaction.objectStore("tags").getAll()
    ]);

    return {
      events,
      tags
    };
  }

  putEvent(
    event: Event
  ): Promise<void> {
    return this.#write("events", (store) => {
      store.put(event);
    });
  }

  deleteEvents(
    events: Iterable<Event>
  ): Promise<void> {
    return this.#write("events", (store) => {
      for (const event of events) {
        store.delete(event.eventId);
      }
    });
  }

  putTag(
    tag: EventTag
  ): Promise<void> {
    return this.#write("tags", (store) => {
      store.put(tag);
    });
  }

  deleteTag(
    assetId: string,
    name: string
  ): Promise<void> {
    return this.#write("tags", (store) => {
      store.delete([assetId, name]);
    });
  }

  close(): void {
    this.#database.close();
  }

  #write(
    storeName: StoreNames<JournalSchema>,
    write: (store: IDBObjectStore) => void
  ): Promise<void> {
    const transaction = this.#database.transaction(storeName, "readwrite");
    write(unwrap(transaction.store));

    return transaction.done;
  }
}
