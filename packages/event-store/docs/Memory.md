# In-memory persistence

Creation is synchronous. The factory comes from the package's browser-safe
main entry point and keeps events only in the store instance that created them.

```ts
EventStore.persistence.memory<TMap>(): TypedEventStore<TMap>
```

The optional `TMap` schema map is described in
[EventStore](./EventStore.md#schema-map); it defaults to an unconstrained map.

```ts
import * as EventStore from "@jolly-pixel/event-store";

using store = EventStore.persistence.memory();
```

Each store is isolated. Its events remain private to that store. Calling
`close()` discards the log immediately, so use a new store for every test or
short-lived workflow that needs a clean event history.

The memory backend still applies the shared
[`EventStore` storage contract](./EventStore.md#storage-contract), including
JSON serialization of `eventData` and `actor`.

## Compaction

[`compact`](./EventStore.md#compaction) removes superseded events from the log.
The `reclaim` option has no effect because this backend has no file to shrink.
