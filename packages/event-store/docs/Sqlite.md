# Sqlite

SQLite-backed `EventStore` using Node's built-in `node:sqlite`, split into a `writer` and a `reader` sharing the same connection.

Durable when `location` is a file path. Ephemeral when `location` is `":memory:"` (which is the default value).

```ts
EventStore.persistence.sqlite(location?: string): EventStore
```

> [!NOTE]
> Automatically creates database schema on startup (`CREATE TABLE IF NOT EXISTS`)

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

Closes the underlying connection. Call this when done with a file-backed instance. Also invoked automatically via `[Symbol.dispose]`, so a `using` declaration works:

```ts
using store = EventStore.persistence.sqlite(path);
```
