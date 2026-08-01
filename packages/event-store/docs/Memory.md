# Memory

In-process `EventStore`, split into a `writer` and a `reader` sharing the same in-memory log.

No disk. No durability. Great for tests and local runs.

```ts
EventStore.persistence.memory(): EventStore
```

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

Clears all stored events. Also invoked automatically via `[Symbol.dispose]`, so a `using` declaration works:

```ts
using store = EventStore.persistence.memory();
```
