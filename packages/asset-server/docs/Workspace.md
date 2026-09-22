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
  handlers: [textureAssetKind()],
  seed: {
    "textures/block.png": () => defaultTextureBytes()
  }
});
```

## Options

```ts
interface AssetWorkspaceOptions {
  root: string;
  handlers?: AssetKindHandler[];
  seed?: AssetSeedMap;
  source?: AssetSource;
  eventStore?: EventStore.TypedEventStore<AssetEventDataMap>;
  server?: Server;
  extensions?: Extension[];
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  logger?: Logger;
  roomGraceMs?: number;
  compactOnOpen?: boolean;
  backend?: AssetBackendTuning;
}

type AssetBackendTuning = Omit<
  AssetBackendOptions,
  "source" | "eventStore" | "handlers" | "logger"
>;
```

`root` is required. Without injected instances, the workspace creates a
`FilesystemAssetSource(root)`, a SQLite event store under `.jollypixel/`, and
a `Server`. `handlers` and `extensions` default to empty arrays. `seed` adds
starter documents before the backend starts.

`rights`, `defaultRole`, `auth`, and `roomGraceMs` configure a server created
by the workspace. `logger` defaults to a silent logger; when it is omitted,
the server keeps its own default. `backend` passes extra
[`AssetBackendOptions`](./AssetBackend.md#options) and defaults to `{}`.
`compactOnOpen` defaults to `true`.

`close()` detaches the room resolver, closes the backend, and closes the
event store if the workspace created it. It leaves the server and source
open. Close the server first so room eviction can flush pending snapshots.

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
type AssetSeedFactory = () => Uint8Array | Promise<Uint8Array>;

interface AssetSeedEntry {
  id: string;
  kind: string;
  content: AssetSeedFactory;
}

type AssetSeedMap = Record<string, AssetSeedFactory | AssetSeedEntry>;

seedAssetSource(source: AssetSource, seed: AssetSeedMap): Promise<string[]>
```

Writes each starter document whose path the source does not hold, and returns
the paths written. An existing file is never overwritten and its factory is
never called: once the workspace exists it is the source of truth.

An `AssetSeedEntry` also records its `id` in the identity sidecar when its
document is written, so other seeded documents can reference the asset by a
known `AssetId`.

## Serving the workspace

The catalog hands the browser workspace-relative `source` paths, which have to
resolve to something. Serve them with
[`createAssetStaticHandler`](../../asset-source/docs/Http.md), passing the
content types the registered kinds declare:

```ts
import { createAssetStaticHandler } from "@jolly-pixel/asset-source";

const handler = createAssetStaticHandler({
  source: workspace.source,
  contentTypes: workspace.backend.kinds.contentTypes()
});
```

[`kinds.contentTypes()`](./AssetKinds.md#registry) collects what each kind
declares. The handler merges it over its `DEFAULT_CONTENT_TYPES`.

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
      handlers: [textureAssetKind()]
    })
  ]
});
```

One plugin mounts the whole workspace on the dev server: the catalog route,
static delivery and the WebSocket the asset rooms are edited through. It
accepts every `createAssetWorkspace` option plus:

```ts
interface AssetWorkspacePluginOptions extends AssetWorkspaceOptions {
  catalogPath?: string;
  prefix?: string;
  socketPath?: string;
  onReady?: (workspace: AssetWorkspace) => void | Promise<void>;
  launch?: (request: AssetLaunchRequest) => string | undefined;
}

interface AssetLaunchRequest {
  readonly url: URL;
  readonly catalog: AssetCatalog;
}
```

`catalogPath` defaults to `/__jollypixel/catalog`, `prefix` to `/assets/`,
and `socketPath` to `/ws-sync`. `onReady` runs when the workspace is ready.
`launch` selects the asset an HTML page opens.

Everything is built inside `configureServer`, so a production build never
opens the event log. `closeBundle` closes the workspace.

`launch` tells an editor page which asset to open, with nothing in the URL:

```ts
createAssetWorkspacePlugin({
  root,
  launch: ({ url, catalog }) => url.searchParams.get("target") ??
    catalog.toJSON().assets.find((record) => record.kind === "voxelmap")?.id
});
```

It receives the requested page URL and the current `AssetCatalog`, and returns
an asset ID or `undefined`. The ID is written into the page head as
`<script type="application/json" id="jolly-launch">{"target":"<id>"}</script>`,
where `LAUNCH_ELEMENT_ID` from `@jolly-pixel/asset` names the element. Nothing
is injected for `undefined`.

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
