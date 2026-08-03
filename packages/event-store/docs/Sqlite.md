# Sqlite

SQLite-backed `EventStore` using Node's built-in `node:sqlite`, split into a `writer` and a `reader` sharing the same connection.

Durable when `location` is a file path. Ephemeral when `location` is `":memory:"` (which is the default value).

```ts
EventStore.persistence.sqlite(location?: string): Promise<EventStore>
```

> [!IMPORTANT]
> This factory is **async**, unlike [`memory`](./Memory.md). `node:sqlite` is loaded through a dynamic `import()` so the package entrypoint stays browser-compatible, and an async import cannot be unwrapped synchronously.

> [!NOTE]
> Automatically creates database schema on startup (`CREATE TABLE IF NOT EXISTS`)

```ts
import * as EventStore from "@jolly-pixel/event-store";

const store = await EventStore.persistence.sqlite("./events.sqlite");
```

Node-only consumers can import the backend directly through the `./sqlite` subpath, which skips the lazy indirection and exposes the writer/reader classes as values:

```ts
import {
  createSqliteEventStore,
  SqliteEventWriter,
  SqliteEventReader
} from "@jolly-pixel/event-store/sqlite";

const store = await createSqliteEventStore("./events.sqlite");
```

> [!WARNING]
> The `./sqlite` subpath depends on `node:sqlite` and is not usable in a browser bundle. Reach for it from server code only — the root entrypoint never pulls it into the eager module graph.

## `writer`

```ts
writer.append(input: AppendInput): Result<Event, Error>
```

## `reader`

```ts
reader.list(assetId: string, fromVersion?: number): Event[]
```

## `close`

```ts
close(): void
```

Closes the underlying connection. Call this when done with a file-backed instance. Also invoked automatically via `[Symbol.dispose]`, so a `using` declaration works once the store is awaited:

```ts
using store = await EventStore.persistence.sqlite(path);
```
