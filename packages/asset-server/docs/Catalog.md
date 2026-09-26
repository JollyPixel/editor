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
- `dependentsOf(assetId)` returns the `AssetRecord` of each asset that
  references `assetId` and still has a record.
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

`projection.dependencies` is a read-only `DependencyIndex`:

```ts
projection.dependencies.has(assetId): boolean;
projection.dependencies.dependenciesOf(assetId): readonly AssetReferenceData[];
projection.dependencies.dependentsOf(assetId): readonly string[];
projection.dependencies.closureOf(assetId): AssetReferenceData[];
projection.dependencies.dependenciesFirst(starts: Iterable<AssetReferenceData>): AssetReferenceData[];
projection.dependencies.toJSON(): DependencyMap;
projection.unindexed(): IterableIterator<AssetRecord>;
```

- A write replaces every outgoing edge of its asset. A rename keeps them and a
  deletion drops them.
- Edges pointing at a deleted asset stay, so `dependencies.dependentsOf`
  still lists the ids that reference it. `projection.dependentsOf` keeps
  only the dependents that still have a record.
- `closureOf` walks edges transitively, breadth first. Each asset is listed
  once, cycles terminate, and the root is never listed.
- `dependenciesFirst` lists `starts` and everything they reach, each asset
  once and after its dependencies. Archive export writes assets in this order.
- `unindexed()` lists the records without edges: assets whose newest write
  predates edges, and assets of kinds that declare none.

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
  backend,
  maxContentBytes: 16 * 1024 * 1024
}));
```

```ts
interface CatalogExtensionOptions {
  backend: ArchiveBackend;
  id?: string;
  maxContentBytes?: number;
  archiveLimits?: ArchiveLimits;
  deleteProtection?: boolean;
}
```

- `backend` supplies the `catalog` projection the room mirrors, the
  `writer` that runs the lifecycle commands, and the rest of the
  [archive](./Archive.md) back-end the archive commands run against.
- `deleteProtection` enables [delete protection](#delete-protection).
  Defaults to `true`.
- `maxContentBytes` caps the decoded size of a `catalog:create` payload and
  of an archive, exported or imported. Defaults to
  `DEFAULT_CATALOG_MAX_CONTENT_BYTES` (16 MiB). A larger payload is rejected
  with `CatalogContentTooLargeError` before anything is written.
- `archiveLimits` caps the decoded entry and archive sizes of an archive
  sent to `catalog:plan` or `catalog:import`. Defaults to the
  [`readAssetArchive`](./Archive.md#readassetarchive) limits.
- `id` overrides the room name. Defaults to `CATALOG_ROOM`.

`createAssetBackend().attach(server)` registers this room with the backend
writer for the usual setup, capped by the `catalogMaxContentBytes` and
`catalogArchiveLimits` backend options.

### Commands

```ts
{ type: "catalog:create", requestId, path, kind?, onConflict?, content: AssetInlineContent }
{ type: "catalog:rename", requestId, assetId, to }
{ type: "catalog:delete", requestId, assetId, force? }
{ type: "catalog:export", requestId, root? }
{ type: "catalog:plan", requestId, content: AssetInlineContent }
{ type: "catalog:import", requestId, content: AssetInlineContent, onConflict: "replace" | "keep" | "copy" }
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
{ type: "catalog:applied", requestId, command, assetId }
{ type: "catalog:applied", requestId, command: "catalog:export", content: AssetInlineContent }
{ type: "catalog:applied", requestId, command: "catalog:plan", plan: ImportPlan }
{ type: "catalog:applied", requestId, command: "catalog:import", report: ImportReport }
{ type: "catalog:rejected", requestId, command, reason }
```

`dependencies` maps each indexed asset to its outgoing edges. On a change it
holds every outgoing edge of the asset after the change, and is absent on
deletion and for an unindexed asset. `eventType` is the `AssetEventType`
that produced the change.

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

`catalog:delete` is refused when [`dependentsOf`](#dependency-edges)
lists an asset, and the `reason` names up to three of them by path. A
client that warned its user resends the command with `force: true`, which
skips the check. The `catalogDeleteProtection` backend option turns the whole
check off.

A client warns without a round trip: `CatalogClient.dependentsOf` applies the
same rule. Deleting a folder is one command per asset, so a caller either
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

`@jolly-pixel/asset-server/client` exports the room protocol types and
constants and `CatalogClient`, with no Node.js dependency.

```ts
import { CatalogClient } from "@jolly-pixel/asset-server/client";

const catalog = await CatalogClient.connect(networkClient, {
  timeoutMs: 5_000
});

const assetId = await catalog.create("textures/new.pixelart", bytes, {
  kind: "pixelart",
  onConflict: "suffix"
});
await catalog.rename(assetId, "textures/stone.pixelart");
await catalog.remove(assetId, { force: true });
```

```ts
interface CatalogConnectOptions {
  timeoutMs?: number;
}

interface CatalogCreateOptions {
  kind?: string;
  onConflict?: "reject" | "suffix";
}

interface CatalogRemoveOptions {
  force?: boolean;
}

interface CatalogImportOptions {
  onConflict: "replace" | "keep" | "copy";
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
| `dependencies` | Read-only `DependencyIndex` of the [dependency edges](#dependency-edges), kept in sync with the room. |
| `dependentsOf(assetId)` | The dependents that still have a record, as `AssetRecordData`; the assets delete protection counts. |
| `dispose()` | Leaves the room and rejects pending requests. |
| `"change"` event | Emitted after the snapshot and each change. |
| `"dependencies"` event | Receives an asset ID whose outgoing edges changed. |

`CatalogClient.connect(rooms, options?)` opens the `CATALOG_ROOM` room on
`rooms` (a `@jolly-pixel/network/client` `Client`, or any
`CatalogRoomSource`) and resolves once the snapshot arrives. With
`timeoutMs`, it rejects with `CatalogUnavailableError` when the snapshot is
late. On failure it leaves the room; the caller still owns `rooms`.
`new CatalogClient(room)` joins an already open `CatalogRoom` without
waiting.

Requests are sent only after `ready`, each with a fresh `requestId`. A
`catalog:rejected` reply, or a reply for another command type, rejects the
request with `CatalogRejectedError` (`message` is the reason, `command` the
command type).

The entry also exports `ARCHIVE_MIME_TYPE` (`"application/zip"`), the type
of the bytes `exportArchive` resolves, plus `ArchiveLimits`,
`DEFAULT_ARCHIVE_MAX_ENTRY_BYTES` and `DEFAULT_ARCHIVE_MAX_BYTES`.

## HTTP handler

```ts
import { createCatalogHandler } from "@jolly-pixel/asset-server/node";

const handler = createCatalogHandler({
  projection,
  path: "/__jollypixel/catalog"
});
```

The default path is `/__jollypixel/catalog`. `GET` returns the JSON snapshot
and `HEAD` returns the same headers without a body. Other methods on that path
receive `405` with `Allow: GET, HEAD`. Requests for another path are passed to
`next()`.

The response carries a strong ETag hashed from the snapshot and
`Cache-Control: no-cache`, so a matching `If-None-Match` answers `304`.

## Vite plugin

```ts
import {
  createAssetCatalogPlugin
} from "@jolly-pixel/asset-server/node";

export default {
  plugins: [createAssetCatalogPlugin({ projection })]
};
```

The plugin accepts the same optional `path` override as the HTTP handler.
