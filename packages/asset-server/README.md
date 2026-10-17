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

## 📈 Benchmarks

```bash
$ pnpm --filter @jolly-pixel/asset-server bench
$ pnpm --filter @jolly-pixel/asset-server bench catalog --allocations
$ pnpm --filter @jolly-pixel/asset-server bench:load --scenario edit --clients 50
```

`bench` runs the micro suites in `bench/*.bench.ts` on the shared
`@jolly-pixel/bench` harness: asset room commands, snapshot writes from 4 KB
to 4 MB, catalog joins, renames and HTTP reads up to 10,000 assets, and the
event primitives. The backend is seeded by appending events, so a suite does
not pay the reconciler's cost. `--allocations` adds a `B/op` column.

`bench:load` starts a seeded backend in a child process and drives it over
real WebSockets and HTTP from worker threads. `edit` sends grid commands,
`join` opens and leaves the catalog room, `catalog` renames assets, `http`
fetches the catalog (`--etag` revalidates it), and `open` joins and leaves
asset rooms so each round replays the asset. The event store is a temporary
sqlite file unless `--store memory` is passed. `--help` lists the knobs. Treat a
run as saturated when the server's event loop utilization nears 1.

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
