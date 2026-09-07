# EventStore

Shared API returned by the built-in persistence factories and `createEventStore`.
Choose a backend in [`Memory`](./Memory.md) or [`Sqlite`](./Sqlite.md).

```ts
export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;
  compact(options: CompactOptions): CompactReport;
  close(): void;
  [Symbol.dispose](): void;
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

## `reader`

```ts
reader.list(assetId: string, fromVersion?: number): Event[]
reader.lastVersionOf(assetId: string, eventTypes: readonly string[]): number
reader.listAll(options?: ListAllOptions): Event[]
reader.listFromCheckpoints(options: ListFromCheckpointsOptions): Event[]
```

`list` returns one asset stream in `eventVersion` order and treats `fromVersion`
as an exclusive lower bound.

`lastVersionOf` returns the version of the newest event on `assetId` whose type
is one of `eventTypes`, or `0` when the stream holds none. A reader that knows
which types rebuild the whole state uses it to resume a fold from the last one
instead of the head. The method returns only the version and does not clone the
matching event. Lookup cost depends on the backend and its stored event count.

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

A reader whose fold restarts from a checkpoint uses this instead of
`listAll`, so its cost tracks the number of assets rather than the depth of
the log.

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

- `eventData` and `actor` pass through JSON serialization. Unsupported values
  such as `BigInt` and `Symbol` fail the append. `Date` values become ISO strings.
- The stored event does not alias the input, and values returned by the reader
  cannot mutate the log.
- `append` returns the same event that a later `list` returns.
- A rejected append consumes neither an `eventId` nor an `eventVersion`.

`test/persistence/conformance.spec.ts` runs this contract against each backend.

## Custom backends

A custom backend implements `EventLog`, which owns storage plus event identity
and version assignment:

```ts
export interface EventLog extends EventReader {
  insert(input: AppendInput): Event;
  compact(options: CompactOptions): CompactReport;
  close(): void;
}
```

Pass the log to `createEventStore` to attach the shared writer:

```ts
import {
  createEventStore,
  type EventLog
} from "@jolly-pixel/event-store";

declare const myLog: EventLog;
const store = createEventStore(myLog);
```
