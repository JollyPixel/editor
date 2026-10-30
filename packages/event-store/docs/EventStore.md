# EventStore

Shared API returned by the [Memory](./Memory.md), [Sqlite](./Sqlite.md) and
[IndexedDb](./IndexedDb.md) factories. Every member returns a promise, and
writes run one at a time in call order.

```ts
export interface EventStore {
  readonly writer: EventWriter;
  readonly reader: EventReader;
  readonly tags: EventTags;
  subscribe(
    listener: (event: Event) => void,
    options?: { eventTypePrefix?: string; }
  ): () => void;
  subscribeRejections(
    listener: (error: Error, input: AppendInput) => void
  ): () => void;
  compact(options: CompactOptions): Promise<CompactReport>;
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}
```

## Data model

```ts
export type Actor =
  | { type: "user"; id: string; }
  | { type: "system"; source: string; };

export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  actor: Actor;
  expectedVersion?: number;
}

export interface Event {
  eventId: number; // position in the whole log
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  eventVersion: number; // position in the asset stream, from 1
  actor: Actor;
  createdAt: string;
}
```

### Schema map

A map of event type to payload narrows what `append` accepts. Reads still
return `Event` with an `unknown` payload, because a stored row may predate the
map: check it before use.

```ts
type SpriteMap = {
  "sprite.created": { path: string; size: number; };
  "sprite.renamed": { from: string; to: string; };
};

const store = EventStore.persistence.memory<SpriteMap>();
```

## writer

```ts
writer.append(input: AppendInput): Promise<Result<Event, Error>>
```

- Resolves with the stored event, or with a `Result` error. It never rejects.
- With `expectedVersion`, the append succeeds only while the asset's newest
  `eventVersion` equals it (`0` for an empty stream). Otherwise it resolves
  with an `EventVersionConflictError`.
- `eventData` and `actor` are stored as JSON: a `Date` comes back as a string
  and a `BigInt` fails the append.

## reader

```ts
export interface EventReader {
  get(assetId: string, eventVersion: number): Promise<Event | undefined>;
  list(assetId: string, fromVersion?: number): Promise<Event[]>;
  listAll(options?: ListAllOptions): Promise<Event[]>;
  listFromCheckpoints(options: ListFromCheckpointsOptions): Promise<Event[]>;
}

export interface ListAllOptions {
  fromEventId?: number; // exclusive
  beforeEventId?: number; // exclusive
  eventTypePrefix?: string;
  limit?: number;
  newestFirst?: boolean;
}

export interface ListFromCheckpointsOptions {
  checkpointEventTypes: readonly string[];
  eventTypePrefix?: string;
  assetId?: string;
}
```

`list` follows `eventVersion` order, the other reads follow `eventId` order.
`fromVersion` is exclusive.

`listFromCheckpoints` returns, for each asset, its newest
[checkpoint](../GLOSSARY.md#checkpoint) and every event after it. An asset
with no checkpoint returns its whole stream. `eventTypePrefix` filters the
result after the checkpoint is chosen, so it never changes which checkpoint
applies.

## subscribe

`subscribe` calls the listener with each accepted event before `append`
resolves. It does not replay history: read the stored events first, then
subscribe. `subscribeRejections` receives each rejected append with its input.

## tags

A tag names one event of an asset and keeps it through compaction.

```ts
export interface EventTags {
  create(input: EventTagInput): Promise<Result<EventTag, Error>>;
  get(assetId: string, name: string): Promise<EventTag | undefined>;
  list(assetId?: string): Promise<EventTag[]>;
  delete(assetId: string, name: string): Promise<boolean>;
}

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
```

`create` resolves with an `UnknownEventError` when the event does not exist,
an `EventTagConflictError` when the name is taken, and a `TypeError` when the
name is empty.

## compact

```ts
export interface CompactOptions {
  checkpointEventTypes: readonly string[];
  reclaim?: boolean; // default true
  assetId?: string;
  keep?: Iterable<{ assetId: string; eventVersion: number; }>;
}

export interface CompactReport {
  removed: number;
  assets: number;
}
```

Removes the events before each asset's newest checkpoint. Tagged and `keep`
events survive, and surviving events keep their `eventId` and `eventVersion`.

> [!WARNING]
> Compaction is irreversible. Only use checkpoint types that replace an
> asset's whole state.

## close

Waits for pending writes, then refuses every later call. Stores work with
`await using`.
