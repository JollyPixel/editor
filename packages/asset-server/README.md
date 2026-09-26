<h1 align="center">
  asset-server
</h1>

<p align="center">
  Server-side asset storage, synchronization and catalog delivery
</p>

## 💃 Getting Started

Install the package with pnpm:

```bash
$ pnpm add @jolly-pixel/asset-server
```

## 👀 Usage example

```ts
import * as EventStore from "@jolly-pixel/event-store";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import { Server } from "@jolly-pixel/network";
import {
  createAssetBackend,
  textureAssetKind
} from "@jolly-pixel/asset-server";

using eventStore = await EventStore.persistence.sqlite(
  "./assets/.jollypixel/events.db"
);

await using backend = await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [textureAssetKind()]
});

await using server = new Server();
backend.attach(server);
```

On startup, the backend catalogs files already present in `./assets`. Changes
made through `backend.writer` are appended to the event store and written to
the asset source. Changes made by external tools are detected and appended as
system events.

## 📚 API

- [`Architecture`](./ARCHITECTURE.md): visual map of event flow, projections,
  live state and reconciliation
- [`AssetBackend`](./docs/AssetBackend.md): setup, options and lifecycle
- [`AssetWriter`](./docs/AssetWriter.md): create, update, rename and remove assets
- [`Asset kinds`](./docs/AssetKinds.md): custom state, serialization and editing rooms
- [`Catalog`](./docs/Catalog.md): catalog projection, network messages and HTTP access
- [`Archive`](./docs/Archive.md): ZIP export and import of an asset with its dependencies
- [`Rooms`](./docs/Rooms.md): dynamic editing rooms and eviction
- [`Sync`](./docs/Sync.md): lifecycle events, snapshots and reconciliation

## ✨ Contributors guide

Read the [contributing guide][contributing] before submitting a change.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/asset-server test
$ pnpm run lint
```

> [!CAUTION]
> Include tests when adding a feature or fixing a bug.

## 📃 License

MIT

<!-- Reference-style links -->

[contributing]: ../../CONTRIBUTING.md
