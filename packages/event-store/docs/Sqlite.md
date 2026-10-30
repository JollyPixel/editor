# SQLite persistence

File-backed store for Node.js, built on the built-in `node:sqlite` module.

```ts
EventStore.persistence.sqlite<TMap>(
  location?: string
): Promise<TypedEventStore<TMap>>
```

`TMap` is the optional [schema map](./EventStore.md#schema-map).

```ts
import * as EventStore from "@jolly-pixel/event-store";

await using store = await EventStore.persistence.sqlite(
  "./events.sqlite"
);
```

- A file `location` creates or opens the database, and creates the directories
  leading to it. The default `":memory:"` lasts until the store closes.
- File databases run in WAL mode with `synchronous=NORMAL`: a power loss can
  drop the last commits, a process crash cannot. SQLite keeps
  `<location>-wal` and `<location>-shm` next to the database while it is open.
- Several connections can share one file. Event versions and tag names stay
  unique across them, and the losing append or `tags.create` resolves with a
  `Result` error.
- `compact` with the default `reclaim: true` shrinks the file. With `false`,
  later inserts reuse the freed pages instead.

## Node-only entry point

The main entry loads the SQLite backend when the factory is called. Node.js
applications can import it directly instead:

```ts
import {
  createSqliteEventStore
} from "@jolly-pixel/event-store/node";

await using store = await createSqliteEventStore(
  "./events.sqlite"
);
```
