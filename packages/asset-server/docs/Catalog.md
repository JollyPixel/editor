# Catalog

`CatalogProjection` folds asset lifecycle events into an
`@jolly-pixel/asset` catalog.

```ts
const projection = new CatalogProjection({ eventStore });
projection.load();
projection.start();
```

- `load()` folds each asset's newest lifecycle checkpoint and the events
  after it. See [Replay](./Sync.md#replay).
- `catalog` exposes the current `AssetCatalog`.
- `size` is the number of cataloged assets.
- `record(assetId)` returns the `AssetRecord`, or `undefined`.
- `snapshot()` returns `AssetManifestData`.
- `changed` is emitted for each recognized lifecycle event applied to the
  catalog. A deleted asset has `record: null`.
- `close()` stops following appended events and removes listeners.

`apply(event)` returns `false` and changes nothing for events outside the
`asset.` prefix and for lifecycle events whose payload does not match their
type. See [Typed payloads](./Sync.md#typed-payloads).

Each catalog record uses the asset content hash as its `revision`.

## Dependency edges

The projection also indexes which assets reference which. Edges come from the
`dependencies` field of `asset.created` and `asset.updated` events (see
[AssetWriter](./AssetWriter.md#create)), so the catalog never decodes content.

```ts
projection.dependenciesOf(assetId): readonly AssetReferenceData[];
projection.dependentsOf(assetId): readonly string[];
projection.closureOf(assetId): AssetReferenceData[];
projection.dependencies(): DependencyMap;
projection.unindexed(): IterableIterator<string>;
```

- A write replaces every outgoing edge of its asset. A rename keeps them and a
  deletion drops them.
- Edges pointing at a deleted asset stay, so `dependentsOf` still lists the
  assets that reference it.
- `closureOf` walks edges transitively, breadth first. Each asset is listed
  once, cycles terminate, and the root is never listed.
- `unindexed()` lists assets whose newest write predates edges.

`createAssetBackend` backfills these assets once at boot: each one whose kind
declares [`dependencies`](./AssetKinds.md) is rewritten with unchanged content
and computed edges. Later boots find nothing to backfill.

The same index is exported as `DependencyIndex` from the browser client entry.

## Network room

`CatalogExtension` provides the `asset-catalog` room. A client receives a
snapshot when it joins and catalog changes while it remains connected, and can
create, rename and delete assets.

```ts
server.register(new CatalogExtension({
  projection,
  writer,
  maxContentBytes: 16 * 1024 * 1024
}));
```

```ts
interface CatalogExtensionOptions {
  projection: CatalogProjection;
  writer: AssetWriter;
  archive?: ArchiveBackend;
  id?: string;
  maxContentBytes?: number;
}
```

- `writer` is the `AssetWriter` that runs the commands.
- `archive` is the back-end the [archive commands](#archives) run against.
  Without it they are rejected.
- `maxContentBytes` caps the decoded size of a `catalog:create` payload and
  of an archive, exported or imported. Defaults to
  `DEFAULT_CATALOG_MAX_CONTENT_BYTES` (16 MiB). A larger payload is rejected
  with `CatalogContentTooLargeError` before anything is written.
- `id` overrides the room name. Defaults to `CATALOG_ROOM`.

`createAssetBackend().attach(server)` registers this room with the backend
writer for the usual setup, capped by the `catalogMaxContentBytes` backend
option.

### Commands

```ts
{ type: "catalog:create", requestId?, path, kind?, onConflict?, content: CatalogInlineContent }
{ type: "catalog:rename", requestId?, assetId, to }
{ type: "catalog:delete", requestId?, assetId, force? }
{ type: "catalog:export", requestId?, root? }
{ type: "catalog:plan", requestId?, content: CatalogInlineContent }
{ type: "catalog:import", requestId?, content: CatalogInlineContent, onConflict: "replace" | "keep" }
```

`content` is the `{ type: "inline", encoding: "base64", data }` shape built by
`encodeContent`. `onConflict` is `"reject"` (default) or `"suffix"`, passed to
`AssetWriter.create` as `onPathConflict`. There is no update command: content changes go through the
asset's own room.

The room runs each command through `AssetWriter`, attributed to
`actorOf(context.identity)` (see [Actors](./Rooms.md#actors)). Paths follow
the writer rules, see
[Errors](./AssetWriter.md#errors). A folder is not an entity: renaming one
means renaming each asset under it, one command at a time.

### Messages

```ts
{ type: "catalog:snapshot", manifest: AssetManifestData, dependencies?: DependencyMap }
{ type: "catalog:changed", change: { eventType, assetId, record, dependencies? } }
{ type: "catalog:applied", requestId?, command, assetId }
{ type: "catalog:applied", requestId?, command: "catalog:export", content: CatalogInlineContent }
{ type: "catalog:applied", requestId?, command: "catalog:plan", plan: ImportPlan }
{ type: "catalog:applied", requestId?, command: "catalog:import", report: ImportReport }
{ type: "catalog:rejected", requestId?, command, reason }
```

`dependencies` maps each indexed asset to its outgoing edges. On a change it
holds every outgoing edge of the asset after the change, and is absent on
deletion and for an unindexed asset.

A successful command reaches every member as `catalog:changed`, through the
same projection that carries reconciler writes, then the author alone gets
`catalog:applied`. A failed command sends `catalog:rejected` to the author
alone and broadcasts nothing. Both echo the command's `requestId`.

A payload that does not match a command schema gets the room's `"error"`
envelope. Rights are checked per command under `asset-catalog.<command type>`
(`asset-catalog.catalog:create`, `asset-catalog.catalog:import`, ...), so a
role can create without deleting:

```ts
new Server({
  rights: {
    author: {
      "asset-catalog.catalog:delete": "read"
    }
  }
});
```

Without a rights table every member can run every command.

Deleting an asset that is open in its own room sends that room a final notice.
See [Deleted assets](./Rooms.md#deleted-assets).

### Delete protection

`catalog:delete` is refused when [`dependentsOf`](#dependency-edges) still
lists a live asset, and the `reason` names up to three of them by path. A
client that warned its user resends the command with `force: true`, which
skips the check. The `catalogDeleteProtection` backend option turns the whole
check off.

A client warns without a round trip: `CatalogClient.dependentsOf` reads the
same index. Deleting a folder is one command per asset, so a caller either
deletes dependents first or forces each command.

Only the room command is guarded.
[`AssetWriter.remove`](./AssetWriter.md#update-rename-and-remove)
and reconciliation stay free, so a file deleted from the source is still
dropped from the catalog.

### Archives

`catalog:export`, `catalog:plan` and `catalog:import` run
[`exportAssetArchive`, `planAssetImport` and `importAssetArchive`](./Archive.md)
on the back-end, so an offline workspace and a server share one
implementation and the rights table applies. The archive travels as inline
base64 content, and each reply goes to the requesting client only.

- `catalog:export` without `root` exports the whole workspace.
- `catalog:plan` writes nothing. Run it first to learn which ids are already
  live and ask for `onConflict` only when some are.
- An archive that fails validation or the pre-flight is answered with
  `catalog:rejected`, the `reason` naming the asset at fault.

## Browser client

`@jolly-pixel/asset-server/catalog/client` exports the room protocol types and
constants and `CatalogClient`, with no Node.js dependency.

```ts
import {
  CatalogClient,
  CatalogSessionArchive,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";

const catalog = new CatalogClient(catalogRoom(networkClient));
await catalog.ready;

const assetId = await catalog.create("textures/new.pixelart", bytes, {
  kind: "pixelart",
  onConflict: "suffix"
});
await catalog.rename(assetId, "textures/stone.pixelart");
await catalog.remove(assetId, { force: true });
```

```ts
interface CatalogCreateOptions {
  kind?: string;
  onConflict?: "reject" | "suffix";
}

interface CatalogRemoveOptions {
  force?: boolean;
}

interface CatalogImportOptions {
  onConflict: "replace" | "keep";
}
```

| Member | Description |
|---|---|
| `ready` | Resolves on the first `catalog:snapshot`. |
| `records()` / `record(assetId)` | Current `AssetRecordData`, kept in sync with `catalog:changed`. |
| `create(path, content, options?)` | Resolves the created asset ID. `options` takes `kind` and `onConflict`. |
| `rename(assetId, to)` / `remove(assetId, options?)` | Resolve once applied. `remove` takes `force` to bypass [delete protection](#delete-protection). |
| `exportArchive(root?)` | Resolves the [archive](./Archive.md) bytes of `root`, or of the whole workspace. |
| `planImport(archive)` | Resolves the `ImportPlan`, writing nothing. |
| `importArchive(archive, { onConflict })` | Resolves the `ImportReport`. |
| `dependenciesOf(assetId)` / `dependentsOf(assetId)` / `closureOf(assetId)` | [Dependency edges](#dependency-edges), kept in sync with the room. |
| `dispose()` | Leaves the room and rejects pending requests. |
| `"change"` event | Emitted after the snapshot and each change. |
| `"dependencies"` event | Receives an asset ID whose outgoing edges changed. |

The client joins the room on construction and sends requests only after
`ready`. A `catalog:rejected` reply rejects the request with
`CatalogRejectedError` (`message` is the server reason, `command` the command
type). `catalogRoom(client)` opens the `CATALOG_ROOM` room on a
`@jolly-pixel/network/client` `Client`; any object matching `CatalogRoom`
works.

`CatalogSessionArchive` adapts those archive methods for browser files. It
exports a ZIP `Blob` and accepts a `Blob` for planning and importing. Pass
`canImport` when constructing it; an import with `canImport: false` rejects
with `ArchiveImportDisabledError`, while export and planning remain available.

```ts
const archive = new CatalogSessionArchive({ catalog, canImport: true });
const blob = await archive.export(assetId);
const plan = await archive.plan(file);
const report = await archive.import(file, { onConflict: "keep" });
```

The browser client entry also exports `ARCHIVE_MIME_TYPE`, `ArchiveCatalog`
and `CatalogSessionArchiveOptions`. The caller decides whether import is
available; the adapter does not inspect workspace persistence.

## HTTP handler

```ts
import { createCatalogHandler } from "@jolly-pixel/asset-server";

const handler = createCatalogHandler({
  projection,
  path: "/__jollypixel/catalog"
});
```

The default path is `/__jollypixel/catalog`. `GET` returns the JSON snapshot
and `HEAD` returns the same headers without a body. Other methods on that path
receive `405` with `Allow: GET, HEAD`. Requests for another path are passed to
`next()`.

## Vite plugin

```ts
import {
  createAssetCatalogPlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";

export default {
  plugins: [createAssetCatalogPlugin({ projection })]
};
```

The plugin accepts the same optional `path` override as the HTTP handler.
