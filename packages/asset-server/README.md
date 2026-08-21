<h1 align="center">
  asset-server
</h1>

<p align="center">
  Server-side asset storage, synchronization and catalog delivery
</p>

## 💃 Getting Started

Install the package with npm:

```bash
$ npm i @jolly-pixel/asset-server
```

`@jolly-pixel/asset-server` runs on the server. Browser code should use
[`@jolly-pixel/asset`](../asset) for asset records and catalogs.

## 👀 Usage example

```ts
import * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";
import {
  createAssetBackend,
  FilesystemAssetSource,
  textureAssetHandler
} from "@jolly-pixel/asset-server";

using eventStore = await EventStore.persistence.sqlite(
  "./assets/.jollypixel/events.db"
);

await using backend = await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [textureAssetHandler()]
});

await using server = new Server({ eventStore });
backend.attach(server);
```

On startup, the backend catalogs files already present in `./assets`. Changes
made through `backend.writer` are appended to the event store and written to
the asset source. Changes made by external tools are detected and appended as
system events.

## 📚 API

- [`AssetBackend`](./docs/AssetBackend.md): setup, options and lifecycle
- [`AssetWriter`](./docs/AssetWriter.md): create, update, rename and remove assets
- [`AssetSource`](./docs/AssetSource.md): in-memory and filesystem storage
- [`Asset kinds`](./docs/AssetKinds.md): custom state, serialization and editing rooms
- [`Catalog`](./docs/Catalog.md): catalog projection, network messages and HTTP access
- [`Rooms`](./docs/Rooms.md): dynamic editing rooms and eviction
- [`Sync`](./docs/Sync.md): lifecycle events, snapshots and reconciliation

## ✨ Contributors guide

Read the [contributing guide][contributing] before submitting a change.

Run these commands from the monorepo root:

```bash
$ npm run test -w @jolly-pixel/asset-server
$ npm run lint
```

> [!CAUTION]
> Include tests when adding a feature or fixing a bug.

## 📃 License

MIT

<!-- Reference-style links -->

[contributing]: ../../CONTRIBUTING.md
