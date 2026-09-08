# EventStore

Shared API returned by the built-in persistence factories.

| Backend | Factory | Storage lifetime | Runtime |
|---|---|---|---|
| [Memory](./Memory.md) | `persistence.memory()` | One store instance | Browser or Node.js |
| [SQLite](./Sqlite.md) | `await persistence.sqlite(location?)` | File-backed, or one connection with `":memory:"` | Node.js |

```ts
export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;
  subscribe(
    listener: EventListener,
    options?: SubscribeOptions
  ): () => void;
  compact(
    options: CompactOptions
  ): CompactReport;
  close(): void;
  [Symbol.dispose](): void;
}
```

## Data model

```ts
type ActorUser = {
  type: "user";
  id: string;
};
type ActorSystem = {
  type: "system";
  source: string;
};
export type Actor = ActorUser | ActorSystem;

export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  actor: Actor;
}

export interface Event {
  eventId: number;
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  eventVersion: number;
  actor: Actor;
  createdAt: string;
}
```

## Schema map

Passing a map of event type to payload shape narrows what `append` accepts.
Every factory takes it as an optional type argument and returns a
`TypedEventStore<TMap>`, which remains assignable to `EventStore`.

```ts
type SpriteMap = {
  "sprite.created": { path: string; size: number; };
  "sprite.renamed": { from: string; to: string; };
};

const store = persistence.memory<SpriteMap>();

store.writer.append({
  assetType: "sprite",
  assetId: "a1",
  eventType: "sprite.created",
  eventData: { path: "a.png", size: 12 },
  actor
});
```

An `eventType` outside the map is rejected, and so is an `eventData` that
does not match the payload its `eventType` declares.

`append` still returns the loose `Event`, so the map only constrains what a
holder of the store writes. A store built without a map therefore satisfies
a `TypedEventStore<TMap>` parameter — its `append` accepts every input the
map describes — while a store built with a different map does not.

`TypedEvent<TMap>` is the discriminated union the map describes. Narrowing on
`eventType` narrows `eventData` with it:

```ts
export type TypedEvent<TMap extends EventDataMap> = {
  [K in EventType<TMap>]: EventEnvelope & {
    eventType: K;
    eventData: TMap[K];
  };
}[EventType<TMap>];
```

Reads are deliberately left untyped. `reader` hands back `Event`, whose
`eventData` is `unknown`, because a stored row is parsed from JSON and may
predate the current map. Validate it with a type guard before use:

```ts
function isSpriteCreated(
  event: Event
): event is Extract<TypedEvent<SpriteMap>, { eventType: "sprite.created"; }> {
  return event.eventType === "sprite.created" &&
    typeof (event.eventData as { path?: unknown; })?.path === "string";
}
```

## `writer`

```ts
writer.append(input: AppendInput): Result<Event, Error>
```

`append` returns the stored event on success, including the `eventId` and
`eventVersion` assigned by the backend. Failures are returned as `Result` errors.

### Events

`writer` is a typed event emitter with this map:

```ts
export type EventStoreEventMap = {
  append: (event: Event) => void;
  error: (error: Error, input: AppendInput) => void;
};
```

`append` is emitted with the stored event after a successful write. `error` is
emitted with the error and original input after a failed write.

## `subscribe`

```ts
export type EventListener = (event: Event) => void;

export interface SubscribeOptions {
  eventTypePrefix?: string;
}

subscribe(listener: EventListener, options?: SubscribeOptions): () => void
```

Calls `listener` with each event the store accepts, in append order, and
returns the function that detaches it. A rejected append notifies nothing.
`eventTypePrefix` matches the start of `eventType` literally, the same way the
reader filters, so a consumer folding one family of events does not filter the
stream itself.

```ts
const unsubscribe = store.subscribe(
  (event) => catalog.apply(event),
  { eventTypePrefix: "asset." }
);
```

Subscribing does not replay history. A projection that starts from stored
events reads them first, then subscribes to follow the log.

`subscribe` covers accepted events only. Use `writer.on("error", ...)` to
observe the appends a backend rejected.

## `reader`

```ts
reader.list(assetId: string, fromVersion?: number): Event[]
reader.listFromCheckpoint(
  assetId: string,
  checkpointEventTypes: readonly string[]
): Event[]
reader.listAll(options?: ListAllOptions): Event[]
reader.listFromCheckpoints(options: ListFromCheckpointsOptions): Event[]
```

`list` returns one asset stream in `eventVersion` order and treats `fromVersion`
as an exclusive lower bound.

`listFromCheckpoint` returns one asset's newest event whose type is in
`checkpointEventTypes`, plus everything appended after it, in `eventVersion`
order. A stream holding no such event comes back whole, and so does one read
with an empty type list. It is the single-asset form of
[`listFromCheckpoints`](#listfromcheckpoints): a consumer that folds one asset
uses it to read only the events its fold still needs.

`listAll` reads every stream in `eventId` order and accepts these filters:

```ts
export interface ListAllOptions {
  fromEventId?: number;
  eventTypePrefix?: string;
  limit?: number;
}
```

- `fromEventId` is an exclusive lower bound.
- `eventTypePrefix` matches the start of `eventType` literally.
- `limit` truncates the ordered result.

### `listFromCheckpoints`

```ts
export interface ListFromCheckpointsOptions {
  checkpointEventTypes: readonly string[];
  eventTypePrefix?: string;
}
```

Returns, for each asset, its newest event whose type is in
`checkpointEventTypes` plus everything appended after it, across every stream
in `eventId` order. An asset holding no checkpoint yields its whole stream,
and an empty `checkpointEventTypes` degrades to `listAll`.

`eventTypePrefix` filters the result without moving the bound: an event
matching the prefix but stored before its asset's checkpoint is still left out.

A reader whose fold restarts from a checkpoint can use this method to process
only each checkpoint and its following events.

## Compaction

```ts
export interface CompactOptions {
  checkpointEventTypes: readonly string[];
  reclaim?: boolean;
}

export interface CompactReport {
  removed: number;
  assets: number;
}
```

`compact` removes every event stored before each asset's newest checkpoint,
which is exactly the set `listFromCheckpoints` already skips. An asset holding
no checkpoint keeps its whole stream, and an empty `checkpointEventTypes`
removes nothing.

> [!WARNING]
> Compaction is destructive and irreversible. Only call it when the checkpoint
> types genuinely replace an asset's whole state, so nothing below them is ever
> read again.

Surviving events keep their `eventId` and `eventVersion`, so a position held
elsewhere stays valid and `append` keeps assigning increasing versions.
`reclaim` defaults to `true` and asks the backend to release the freed space.

## Lifecycle

```ts
close(): void
[Symbol.dispose](): void
```

`close()` is idempotent. A closed store rejects later reads and writes.
`[Symbol.dispose]` calls `close()`, so stores work with `using` declarations.

## Storage contract

All backends follow the same behavior:

- `eventData` and `actor` pass through JSON serialization. `BigInt` values
  cannot be stored, top-level values such as `undefined` and `Symbol` fail the
  append, object properties with those values are omitted, and `Date` values
  become ISO strings.
- The stored event does not alias the input, and values returned by the reader
  cannot mutate the log.
- `append` returns an event equivalent to the one returned by a later `list`.
- A rejected append consumes neither an `eventId` nor an `eventVersion`.
