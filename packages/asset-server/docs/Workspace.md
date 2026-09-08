# Workspace

`createAssetWorkspace` assembles what a host needs to edit an asset
workspace live: a source, an event log, the back-end, and the network server
its rooms are attached to.

```ts
createAssetWorkspace(options: AssetWorkspaceOptions): Promise<AssetWorkspace>
```

```ts
await using workspace = await createAssetWorkspace({
  root: "./assets",
  handlers: [textureAssetHandler()],
  seed: {
    "textures/block.png": () => defaultTextureBytes()
  }
});
```

## Options

| Option | Default | Description |
|---|---|---|
| `root` | required | Filesystem root, behind the default source and event log. |
| `handlers` | `[]` | Asset kind handlers. Unmatched paths use `binary`. |
| `seed` | none | Starter documents, written only where the workspace holds no file. |
| `source` | `FilesystemAssetSource(root)` | Physical storage. |
| `eventStore` | sqlite in the state directory | Event log. |
| `server` | a new `Server` | Network server hosting the rooms. |
| `extensions` | `[]` | Extensions registered before the asset rooms attach. |
| `rights` | none | Rights map for the server it builds. |
| `roomGraceMs` | server default | Grace period before an empty room is evicted. |
| `compactOnOpen` | `true` | Drop the events superseded by each asset's newest checkpoint. |
| `logger` | silent | A `loglayer` logger. Left unset, the server keeps its own. |
| `backend` | `{}` | Extra [`AssetBackend`](./AssetBackend.md) options. |

The workspace owns only what it creates: a source, event store or server
passed in is left open by `close()`.

Seeding runs before the back-end starts, so the first reconciliation catalogs
the starter documents.

## Compaction

Every `asset.created` and `asset.updated` event carries the whole document
inline, so a log that keeps them all grows with each edit and startup slows
with it. Opening a workspace therefore compacts the log first, dropping the
events stored before each asset's newest `asset.created`, `asset.updated` or
`asset.deleted`. Nothing reads below that point: both projections load from
it, and so does state replay.

> [!WARNING]
> Compaction is destructive and irreversible. It discards the editing history
> in exchange for a log that stops growing without bound. Pass
> `compactOnOpen: false` to keep it.

It runs before the back-end, so the projections never read the superseded
events and the reclaimed file is the one the back-end opens. See
[`EventStore compaction`](../../event-store/docs/EventStore.md#compaction).

## Event log

Without an `eventStore` option the workspace opens a sqlite log at
`.jollypixel/events.db` under the root, and the backend creates the directories
it needs. Pass `eventStore` to bring your own, in which case `close()` leaves
it open.

## Seeding

```ts
seedAssetSource(source: AssetSource, seed: AssetSeedMap): Promise<string[]>
```

Writes each starter document whose path the source does not hold, and returns
the paths written. An existing file is never overwritten and its factory is
never called: once the workspace exists it is the source of truth.

## Serving the workspace

The catalog hands the browser workspace-relative `source` paths, which have to
resolve to something.

```ts
import { createAssetStaticHandler } from "@jolly-pixel/asset-server/static";

const handler = createAssetStaticHandler({
  source: workspace.source,
  kinds: workspace.backend.kinds
});
```

Requests outside the prefix are passed to `next()`. `GET` and `HEAD` answer
`200` from the source, other methods `405`. Reads go through the
`AssetSource`, so an in-memory workspace is servable too.

The request target is stripped of its query and fragment, decoded once, then
validated by
[`safeAssetPath`](../../asset-source/docs/AssetSource.md#paths), so the source
only ever sees a root-relative POSIX path. The rejection decides the status:

| Case | Status |
|---|---|
| Absolute, drive-qualified or `..` path, source refusing the path | `403` |
| Malformed escape sequence, control character in the path | `400` |
| Missing file, directory target, state directory, path the source ignores | `404` |

The state directory is matched case-insensitively, because a
case-insensitive filesystem answers `.JOLLYPIXEL/state.json` from
`.jollypixel/`. Paths a source hides through `isIgnored` (`.git/`,
`node_modules/`, `dist/` by default) answer `404` as well, so the handler
never serves what listing and reconciliation deliberately skip.

| Option | Default | Description |
|---|---|---|
| `source` | required | Workspace the bytes are read from. |
| `prefix` | `/assets/` | URL prefix, with a trailing slash added when missing. |
| `kinds` | none | Registry contributing content types per claimed extension. |
| `contentTypes` | none | Extension-to-content-type entries, winning over the kinds. |

Content types come from [what each kind declares](./AssetKinds.md#content-types)
merged over a small default table; anything unmatched is served as
`application/octet-stream`.

`@jolly-pixel/asset` exports `ASSET_URL_PREFIX`, `CATALOG_URL_PATH` and
`assetSourceUrl(source)` so the browser builds the same URLs without repeating
the routes.

## Vite plugin

```ts
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: path.join(import.meta.dirname, "assets"),
      handlers: [textureAssetHandler()]
    })
  ]
});
```

One plugin mounts the whole workspace on the dev server: the catalog route,
static delivery and the WebSocket the asset rooms are edited through. It
accepts every `createAssetWorkspace` option plus:

| Option | Default | Description |
|---|---|---|
| `catalogPath` | `/__jollypixel/catalog` | Catalog route. |
| `prefix` | `/assets/` | URL prefix the workspace is served under. |
| `socketPath` | `/ws-sync` | WebSocket upgrade path, kept apart from Vite HMR. |
| `onReady` | none | Receives the workspace once the back-end is up. |

Everything is built inside `configureServer`, so a production build never
opens the event log. `closeBundle` closes the workspace.

Use `onReady`, or pass your own `server`, when the dev server also hosts rooms
of its own:

```ts
createAssetWorkspacePlugin({
  root,
  extensions: [new MyDemoRoom()],
  onReady: ({ backend }) => reportCatalogSize(backend.catalog.size)
});
```

`createAssetCatalogPlugin` and `createAssetStaticPlugin` remain available for
a host wiring the pieces itself.
