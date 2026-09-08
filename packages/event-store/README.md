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

store.writer.append({
  assetType: "pixelart",
  assetId: "<UUID>",
  eventType: "pixelart.command",
  eventData: {
    action: "uv-region-moved",
    metadata: {},
    clientId: "533454a2-4f09-47c5-8e24-dc5d479c578e",
    timestamp: 1788814248122
  },
  actor: {
    type: "user",
    id: "533454a2-4f09-47c5-8e24-dc5d479c578e"
  }
}).unwrap();

const events = store.reader.list("<UUID>");
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

- [`Memory`](./docs/Memory.md): in-process storage
- [`Sqlite`](./docs/Sqlite.md): durable Node.js storage

> [!NOTE]
> The package entrypoint is safe to import from browser code. `persistence.sqlite`
> loads its Node-only backend when called.

## 📈 Benchmarks

```bash
$ npm run bench -w @jolly-pixel/event-store
$ npm run bench -w @jolly-pixel/event-store -- read
```

Suites live in [`bench/`](./bench) and run on the shared `@jolly-pixel/bench`
harness. They cover `append`, the reader, `listFromCheckpoints` against
`listAll`, and `compact`, over three backends: `memory`, `sqlite:memory` and
`sqlite:file`.

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
