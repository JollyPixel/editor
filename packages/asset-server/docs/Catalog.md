# Catalog

`CatalogProjection` folds asset lifecycle events into an
`@jolly-pixel/asset` catalog.

```ts
const projection = new CatalogProjection({ eventStore });
projection.load();
projection.start();
```

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

`CatalogExtension` provides a read-only `asset-catalog` room. A client receives
a snapshot when it joins and catalog changes while it remains connected.

```ts
server.register(new CatalogExtension({ projection }));
```

```ts
{ type: "catalog:snapshot", manifest: AssetManifestData }
{ type: "catalog:changed", change: { eventType, assetId, record } }
```

`createAssetBackend().attach(server)` registers this room for the usual setup.

## HTTP handler

```ts
import { createCatalogHandler } from "@jolly-pixel/asset-server/catalog";

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
