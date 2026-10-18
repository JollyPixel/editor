// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { MemoryEventLog } from "../memory/log.ts";
import {
  IndexedDbJournal,
  type IndexedDbEventStoreOptions
} from "./journal.ts";

export type { IndexedDbEventStoreOptions } from "./journal.ts";

export async function createIndexedDbEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  options: IndexedDbEventStoreOptions
): Promise<TypedEventStore<TMap>> {
  const journal = await IndexedDbJournal.open(options);
  try {
    return createEventStore<TMap>(
      new MemoryEventLog({
        ...await journal.load(),
        journal
      })
    );
  }
  catch (error) {
    journal.close();

    throw error;
  }
}

export function destroyIndexedDbEventStore(
  options: IndexedDbEventStoreOptions
): Promise<void> {
  return IndexedDbJournal.destroy(options);
}
