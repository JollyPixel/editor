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
```

## 👀 Usage example

```ts
import * as EventStore from "@jolly-pixel/event-store";

const store = EventStore.persistence.memory();

const result = store.writer.append({
  assetType: "texture",
  assetId: "asset-1",
  eventType: "pixel-set",
  eventData: { x: 1, y: 2, color: "#ffffff" },
  actor: { type: "user", id: "alice" }
}).unwrap();
console.log(result);

const events = store.reader.list("asset-1");
console.log(events);
```

## 📚 API

All backends expose the same [`EventStore`](./docs/EventStore.md) API.

### 📦 Persistence

Each factory returns a `writer` and a `reader` sharing the same storage, plus lifecycle `close()`.

```ts
import * as EventStore from "@jolly-pixel/event-store";

EventStore.persistence.memory();
await EventStore.persistence.sqlite();
```

- [`EventStore`](./docs/EventStore.md): shared writer, reader, events and lifecycle
- [`Memory`](./docs/Memory.md): in-process storage
- [`Sqlite`](./docs/Sqlite.md): durable Node.js storage

> [!NOTE]
> `sqlite` is async, `memory` is synchronous. See [Browser compatibility](#-browser-compatibility).

### 🌐 Browser compatibility

The package entrypoint is safe to import from browser code. `persistence.sqlite`
loads its Node-only backend when called. Server code may also import it through
`@jolly-pixel/event-store/sqlite`. See [`Sqlite`](./docs/Sqlite.md).

### 📡 Events

`writer` emits `append` after a successful append and `error` after a failed one.
See [`EventStore`](./docs/EventStore.md#events).

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ npm run test -w @jolly-pixel/event-store
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
