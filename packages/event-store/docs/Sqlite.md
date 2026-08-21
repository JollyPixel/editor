# Sqlite

SQLite-backed `EventStore` using Node's built-in `node:sqlite`, split into a `writer` and a `reader` sharing the same connection.

Durable when `location` is a file path. Ephemeral when `location` is `":memory:"` (which is the default value).

```ts
EventStore.persistence.sqlite(location?: string): Promise<EventStore>
```

> [!IMPORTANT]
> This factory is **async**, unlike [`memory`](./Memory.md), because the SQLite backend is loaded only when called.

> [!NOTE]
> The factory creates the database schema when needed. Files created before the
> `(asset_id, event_version)` uniqueness constraint must be recreated to pick it up.

```ts
import * as EventStore from "@jolly-pixel/event-store";

const store = await EventStore.persistence.sqlite("./events.sqlite");
```

Node-only consumers can import the factory directly through the `./sqlite` subpath,
which depends on `node:sqlite` and cannot be used in browser bundles:

```ts
import { createSqliteEventStore } from "@jolly-pixel/event-store/sqlite";

const store = await createSqliteEventStore("./events.sqlite");
```

See [`EventStore`](./EventStore.md) for the shared writer and reader API.

## Concurrent appends

`append` assigns versions atomically, so concurrent writers cannot store duplicate
versions for the same asset.

## `close`

```ts
close(): void
```

Closes the underlying connection. See
[`EventStore lifecycle`](./EventStore.md#lifecycle) for closed-store behavior and
`[Symbol.dispose]`.

```ts
using store = await EventStore.persistence.sqlite(path);
```
