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
  /** @default globalThis.indexedDB */
  factory?: IDBFactory;
}
```

The optional `TMap` schema map is described in
[EventStore](./EventStore.md#schema-map); it defaults to an unconstrained map.

```ts
import * as EventStore from "@jolly-pixel/event-store";

using store = await EventStore.persistence.indexeddb({
  name: "jolly-events:my-workspace"
});
```

The factory opens or creates the database `name`, with an `events` store keyed
by `eventId` and a `tags` store keyed by `[assetId, name]`, and loads both
before it resolves. Reads never touch IndexedDB afterwards. The `indexedDB`
global is only reached when the factory runs, so importing the package in
Node.js stays safe; pass `factory` to use another implementation, such as
`fake-indexeddb` in tests.

## Writes

`append`, `tags.create`, `tags.delete` and `compact` issue their IndexedDB
request in a transaction opened before they return, then update the in-memory
log. A call that changes nothing, such as deleting a missing tag, writes
nothing. Nothing waits on a timer or a promise first, so a page that reloads right
after an append finds the event once IndexedDB has committed it. Another
connection to the same database reads it as soon as that transaction ends,
even if the writing store is never closed.

When IndexedDB aborts a write, quota errors included, the in-memory log keeps
the change but the store stops writing: every later change fails with the
error IndexedDB reported and leaves the in-memory log as it was. Reads keep
working.

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

`close()` discards the in-memory log and closes the connection. IndexedDB still
commits the writes already issued. `destroy` deletes the database `name`. An
open store on it closes its connection first, then fails on its next write.
