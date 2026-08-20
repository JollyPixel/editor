# EventStore

Shared API returned by the built-in persistence factories and `createEventStore`.
Choose a backend in [`Memory`](./Memory.md) or [`Sqlite`](./Sqlite.md).

```ts
export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;
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
reader.listAll(options?: ListAllOptions): Event[]
```

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
