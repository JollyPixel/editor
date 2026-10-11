# EventStore

Shared API returned by the built-in persistence factories.

| Backend | Factory | Storage lifetime | Runtime |
|---|---|---|---|
| [Memory](./Memory.md) | `persistence.memory()` | One store instance | Browser or Node.js |
| [SQLite](./Sqlite.md) | `await persistence.sqlite(location?)` | File-backed, or one connection with `":memory:"` | Node.js |

```ts
export interface EventStore {
  readonly writer: EventWriter;
  readonly reader: EventReader;
  readonly tags: EventTags;
  subscribe(
    listener: EventListener,
    options?: SubscribeOptions
  ): () => void;
  subscribeRejections(
    listener: RejectionListener
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
  expectedVersion?: number;
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

### Expected version

`expectedVersion` makes the append conditional: it succeeds only while the
asset's newest `eventVersion` equals it (`0` for an empty stream). Otherwise
`append` returns an `EventVersionConflictError` and stores nothing:

```ts
class EventVersionConflictError extends Error {
  readonly assetId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
}
```

The check and the insert are one statement, so another connection cannot
append in between. A writer that derived the event from state at version `v`
passes `v` to make sure nothing landed since.

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

### `subscribeRejections`

```ts
export type RejectionListener = (error: Error, input: AppendInput) => void;

subscribeRejections(listener: RejectionListener): () => void
```

Calls `listener` with the error and the original input of each append the
store rejects, and returns the function that detaches it. `append` still
returns the same error, so the appender handles it either way.

## `reader`

```ts
reader.get(assetId: string, eventVersion: number): Event | undefined
reader.list(assetId: string, fromVersion?: number): Event[]
reader.listAll(options?: ListAllOptions): Event[]
reader.listFromCheckpoints(options: ListFromCheckpointsOptions): Event[]
```

`get` returns the event stored at one version of an asset, or `undefined` when
the stream does not hold that version, for example after compaction removed it.

`list` returns one asset stream in `eventVersion` order and treats `fromVersion`
as an exclusive lower bound.

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
  assetId?: string;
}
```

Returns, for each asset, its newest event whose type is in
`checkpointEventTypes` plus everything appended after it, across every stream
in `eventId` order. An asset holding no checkpoint yields its whole stream,
so an empty `checkpointEventTypes` returns every event, or the whole stream
when `assetId` is set.

`eventTypePrefix` filters the result without moving the bound: an event
matching the prefix but stored before its asset's checkpoint is still left out.

`assetId` limits the read to one stream, which then comes back in
`eventVersion` order as well. A consumer that folds one asset uses it to read
only the events its fold still needs:

```ts
const events = store.reader.listFromCheckpoints({
  assetId: "a1",
  checkpointEventTypes: ["asset.created", "asset.updated"]
});
```

## `tags`

```ts
export interface EventTagInput {
  assetId: string;
  name: string;
  eventVersion: number;
  message?: string;
  actor: Actor;
}

export interface EventTag extends EventTagInput {
  createdAt: string;
}

tags.create(input: EventTagInput): Result<EventTag, Error>
tags.get(assetId: string, name: string): EventTag | undefined
tags.list(assetId?: string): EventTag[]
tags.delete(assetId: string, name: string): boolean
```

A tag names one event of one asset stream and keeps that event through
[compaction](#compaction). Its name is unique within the asset, and several
names may point at the same event. The store only refuses an empty name; any
other naming rule belongs to the consumer.

```ts
const [checkpoint] = store.reader.listFromCheckpoints({
  assetId: "a1",
  checkpointEventTypes: ["asset.created", "asset.updated"]
});

store.tags.create({
  assetId: "a1",
  name: "v1",
  eventVersion: checkpoint.eventVersion,
  message: "First pass",
  actor
}).unwrap();
```

`create` returns the stored tag with the `createdAt` the store assigned. It
returns an error and stores nothing when:

- the stream holds no event at `eventVersion`, including one that compaction
  already removed: `UnknownEventError`;
- the asset already has a tag with that name: `EventTagConflictError`;
- `name` is empty: `TypeError`.

```ts
class UnknownEventError extends Error {
  readonly assetId: string;
  readonly eventVersion: number;
}

class EventTagConflictError extends Error {
  readonly assetId: string;
  readonly tagName: string;
}
```

`list` returns tags in creation order, across every asset or for one. A tag
never moves: to point a name at another event, delete it and create it again,
which also moves it to the end of the list.

`delete` returns `false` when the tag does not exist. It leaves the event in
place, and the next `compact` removes that event unless another tag still
points at it.

## Compaction

```ts
export interface CompactOptions {
  checkpointEventTypes: readonly string[];
  reclaim?: boolean;
  assetId?: string;
}

export interface CompactReport {
  removed: number;
  assets: number;
}
```

`compact` removes every event stored before each asset's newest checkpoint,
which is the set `listFromCheckpoints` already skips, minus the events a
[tag](#tags) points at. An asset holding no checkpoint keeps its whole stream,
and an empty `checkpointEventTypes` removes nothing. `assetId` limits the pass
to one asset.

Because tagged events stay, `list` and `listAll` can return a stream with gaps
below its newest checkpoint, such as `v3, v9, v10`. `listFromCheckpoints` never
returns a tagged event once a newer checkpoint exists.

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

`close()` is idempotent. A closed store rejects later reads and writes with an
`EventLogClosedError`: `append` and `tags.create` return it, and every other
member throws it.
`[Symbol.dispose]` calls `close()`, so stores work with `using` declarations.

## Storage contract

All backends follow the same behavior:

- `eventData` and `actor` pass through JSON serialization. `BigInt` values
  cannot be stored, top-level values such as `undefined` and `Symbol` fail the
  append, object properties with those values are omitted, and `Date` values
  become ISO strings.
- The stored event does not alias the input, and values returned by the reader
  or `tags` cannot mutate the log.
- `append` returns an event equivalent to the one returned by a later `list`.
- A rejected append consumes neither an `eventId` nor an `eventVersion`.
