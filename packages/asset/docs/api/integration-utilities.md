# Integration utilities

These constants define URL and room-name conventions shared by JollyPixel
browser, server, and collaboration packages. Game code rarely calls them.

Asset room names are modelled by [`AssetRoom`](./domain/AssetRoom.md).

## Asset routes

```ts
const CATALOG_URL_PATH = "/__jollypixel/catalog";
const ASSET_URL_PREFIX = "/assets/";
```

`CATALOG_URL_PATH` is the shared route for a catalog manifest.
`ASSET_URL_PREFIX` is the default route prefix for asset bytes.
