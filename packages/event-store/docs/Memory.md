# In-memory persistence

Store that lives in one instance, for the browser or Node.js. Creation is
synchronous; reads and writes still return promises.

```ts
EventStore.persistence.memory<TMap>(): TypedEventStore<TMap>
```

`TMap` is the optional [schema map](./EventStore.md#schema-map).

```ts
import * as EventStore from "@jolly-pixel/event-store";

await using store = EventStore.persistence.memory();
```

- Each store is isolated, and `close()` discards its events and tags. Use a new
  store for every test that needs a clean history.
- Events still go through JSON, like every [`append`](./EventStore.md#writer).
- `compact` ignores `reclaim`: there is no file to shrink.
