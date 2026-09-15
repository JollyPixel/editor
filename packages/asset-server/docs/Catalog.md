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
- `snapshot()` returns `AssetManifestData`.
- `changed` is emitted for each recognized lifecycle event applied to the
  catalog. A deleted asset has `record: null`.
- `close()` stops following appended events and removes listeners.

`apply(event)` returns `false` and changes nothing for events outside the
`asset.` prefix and for lifecycle events whose payload does not match their
type. See [Typed payloads](./Sync.md#typed-payloads).

Each catalog record uses the asset content hash as its `revision`.

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

- `writer` is the `AssetWriter` that runs the commands.
- `maxContentBytes` caps the decoded size of a `catalog:create` payload.
  Defaults to `DEFAULT_CATALOG_MAX_CONTENT_BYTES` (16 MiB). A larger payload
  is rejected with `CatalogContentTooLargeError` before anything is decoded
  or written.
- `id` overrides the room name. Defaults to `CATALOG_ROOM`.

`createAssetBackend().attach(server)` registers this room with the backend
writer for the usual setup.

### Commands

```ts
{ type: "catalog:create", requestId?, path, kind?, content: AssetInlineContent }
{ type: "catalog:rename", requestId?, assetId, to }
{ type: "catalog:delete", requestId?, assetId }
```

`content` is the `{ type: "inline", encoding: "base64", data }` shape built by
`encodeContent`. There is no update command: content changes go through the
asset's own room.

The room runs each command through `AssetWriter`, attributed to
`actorOf(context.identity)` (see [Actors](./Rooms.md#actors)). Paths follow
the writer rules, see
[Errors](./AssetWriter.md#errors). A folder is not an entity: renaming one
means renaming each asset under it, one command at a time.

### Messages

```ts
{ type: "catalog:snapshot", manifest: AssetManifestData }
{ type: "catalog:changed", change: { eventType, assetId, record } }
{ type: "catalog:applied", requestId?, command, assetId }
{ type: "catalog:rejected", requestId?, command, reason }
```

A successful command reaches every member as `catalog:changed`, through the
same projection that carries reconciler writes, then the author alone gets
`catalog:applied`. A failed command sends `catalog:rejected` to the author
alone and broadcasts nothing. Both echo the command's `requestId`.

A payload that does not match a command schema gets the room's `"error"`
envelope. Rights are checked per command under `asset-catalog.catalog:create`,
`asset-catalog.catalog:rename` and `asset-catalog.catalog:delete`, so a role
can create without deleting:

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
