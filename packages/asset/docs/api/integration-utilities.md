# Integration utilities

These helpers define URL and room-name conventions shared by JollyPixel
browser, server, and collaboration packages. Game code rarely calls them.

Asset room names are modelled by [`AssetRoom`](./domain/AssetRoom.md).

## Asset URLs

```ts
const CATALOG_URL_PATH = "/__jollypixel/catalog";
const ASSET_URL_PREFIX = "/assets/";

function assetSourceUrl(
  source: string,
  prefix?: string
): string;
```

`CATALOG_URL_PATH` is the shared route for a catalog manifest.
`ASSET_URL_PREFIX` is the default route prefix for asset bytes.

`assetSourceUrl()` removes empty path segments, percent-encodes each remaining
segment, and preserves the separators. It accepts a custom prefix with or
without a trailing slash:

```ts
assetSourceUrl("my textures/a&b.png");
// "/assets/my%20textures/a%26b.png"

assetSourceUrl("models/hero.glb", "/workspace");
// "/workspace/models/hero.glb"
```
