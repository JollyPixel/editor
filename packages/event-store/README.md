<h1 align="center">
  event-store
</h1>

<p align="center">
  Append-only log for JollyPixel's events
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/event-store
# or
$ yarn add @jolly-pixel/event-store
```

## 👀 Usage example

```ts
import * as EventStore from "@jolly-pixel/event-store";

const store = EventStore.persistence.memory();

const result = store.writer.append({
  assetType: "texture",
  assetId: "asset-1",
  eventType: "pixel-set",
  eventData: { x: 1, y: 2, color: "#ffffff" }
}).unwrap();
console.log(result);

const events = store.reader.list("asset-1");
console.log(events);
```

## 📚 API

```ts
export interface Event {
  eventId: number;
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
  eventVersion: number;
  createdAt: string;
}
```

### 📦 Persistence

CQRS split: each backend factory returns a `writer` and a `reader` sharing the same underlying storage, plus lifecycle `close()`.

```ts
import * as EventStore from "@jolly-pixel/event-store";

EventStore.persistence.memory();
await EventStore.persistence.sqlite();
```

- [`Memory`](./docs/Memory.md)
- [`Sqlite`](./docs/Sqlite.md)

> [!NOTE]
> `sqlite` is async, `memory` is not. See [Browser compatibility](#-browser-compatibility).

Every factory returns the same `EventStore` shape

```ts
export interface AppendInput {
  assetType: string;
  assetId: string;
  eventType: string;
  eventData: unknown;
}

export interface EventWriter {
  append(
    input: AppendInput
  ): Result<Event, Error>;
}

export interface EventReader {
  list(
    assetId: string,
    fromVersion?: number
  ): Event[];
}

export interface EventStore {
  readonly writer: EventWriter & TypedEventEmitter<EventStoreEventMap>;
  readonly reader: EventReader;
  close(): void;
  [Symbol.dispose](): void;
}
```

### 🌐 Browser compatibility

The package entrypoint is safe to import from browser code: its eagerly-evaluated module graph contains no `node:` builtin. The SQLite backend is reachable but never loaded up front —

- `persistence.sqlite` is a lazy loader that `import()`s the backend on first call, which is why it is async while `persistence.memory` stays synchronous.
- The backend itself resolves `node:sqlite` through a dynamic `import()`, and its schema is an inlined string rather than a `node:fs` read.
- `SqliteEventWriter` / `SqliteEventReader` are exported from the root as **types only**. Import them as values from `@jolly-pixel/event-store/sqlite` (Node-only).

`test/browser-compat.spec.ts` enforces this by walking the eager module graph, so a stray static import fails the suite.

### 📡 Events

`writer` implements an `EventEmitter` exposing the following events

```ts
export type EventStoreEventMap = {
  append: (
    event: Event
  ) => void;
  error: (
    error: Error,
    input: AppendInput
  ) => void;
};
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
