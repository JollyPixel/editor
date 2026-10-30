# IndexedDB persistence

Durable store for the browser. It keeps the whole log in memory, like
[`persistence.memory`](./Memory.md), and commits every write to an IndexedDB
database before the write resolves, so a reloaded page finds it again.

```ts
EventStore.persistence.indexeddb<TMap>(
  options: IndexedDbEventStoreOptions
): Promise<TypedEventStore<TMap>>

EventStore.persistence.indexeddb.destroy(
  options: IndexedDbEventStoreOptions
): Promise<void>

interface IndexedDbEventStoreOptions {
  name: string;
}
```

`TMap` is the optional [schema map](./EventStore.md#schema-map).

```ts
import * as EventStore from "@jolly-pixel/event-store";

await using store = await EventStore.persistence.indexeddb({
  name: "jolly-events:my-workspace"
});
```

- The factory loads the whole database before it resolves. Reads never touch
  IndexedDB afterwards.
- A write IndexedDB aborts, quota errors included, fails that call and leaves
  the store as it was.
- Give each database one writer: two stores open on the same database do not
  see each other's appends.
- `destroy`, or another connection deleting or upgrading the database, closes
  the store's connection. Later writes fail with `InvalidStateError`.
- `compact` ignores `reclaim`: the browser manages the database's space.
- Node.js tests can install the IndexedDB globals with `fake-indexeddb/auto`.
