# Memory

In-process `EventStore`, split into a `writer` and a `reader` sharing the same in-memory log.

No disk. No durability. Great for tests and local runs.

```ts
EventStore.persistence.memory(): EventStore
```

See [`EventStore`](./EventStore.md) for the shared writer and reader API.

## Compaction

`compact` drops the superseded events from the in-process log. There is no
file to shrink, so `reclaim` is ignored. See
[`EventStore compaction`](./EventStore.md#compaction).

## `close`

```ts
close(): void
```

Drops all stored events. See [`EventStore lifecycle`](./EventStore.md#lifecycle) for
closed-store behavior and `[Symbol.dispose]`.

```ts
using store = EventStore.persistence.memory();
```
