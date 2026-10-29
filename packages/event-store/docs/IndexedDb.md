# IndexedDB persistence

Use this backend for a durable store in the browser. It keeps the whole log in
memory, like [`persistence.memory`](./Memory.md), and writes every change to an
IndexedDB database so a later page finds it again.

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

The optional `TMap` schema map is described in
[EventStore](./EventStore.md#schema-map); it defaults to an unconstrained map.

```ts
import * as EventStore from "@jolly-pixel/event-store";

await using store = await EventStore.persistence.indexeddb({
  name: "jolly-events:my-workspace"
});
```

The factory opens or creates the database `name`, with an `events` store keyed
by `eventId` and a `tags` store keyed by `[assetId, name]`, and loads both
before it resolves. Reads never touch IndexedDB afterwards. The `indexedDB`
global is only reached when the factory runs, so importing the package in
Node.js stays safe. Node.js tests can install the IndexedDB globals with
`fake-indexeddb/auto`.

## Writes

`append`, `tags.create`, `tags.delete` and `compact` write to IndexedDB in
their own `readwrite` transaction, wait for it to commit, and only then update
the in-memory log. Once the promise settles, a page that reloads finds the
change, and another connection to the same database reads it even if the
writing store is never closed. A call that changes nothing, such as deleting a
missing tag, writes nothing.

When IndexedDB aborts a write, quota errors included, that call fails with the
error IndexedDB reported and the in-memory log stays as it was. The next write
tries again.

The store closes its connection when another connection deletes or upgrades the
database. Later writes then fail with IndexedDB's `InvalidStateError`.

## Ids and versions

A reopened store continues from the highest `eventId` and from each asset's
highest `eventVersion` it loaded. Two stores open on the same database at the
same time do not see each other's appends: give each database one writer.

## Compaction

[`compact`](./EventStore.md#compaction) deletes the superseded events from the
database in the same transaction pattern as other writes. The `reclaim` option
has no effect: the browser manages the space of the database.

## Lifetime

`close()` waits for the writes issued before it, then discards the in-memory
log and closes the connection. `destroy` deletes the database `name`. An
open store on it closes its connection first, then fails on its next write.
