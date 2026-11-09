# Runtime

`@jolly-pixel/editor.pixel-art/runtime` is the package's runtime contribution
(`jollypixel.runtime`): it lets a game load `pixelart` assets.

```ts
const PIXEL_ART_DOCUMENT: AssetType<PixelDocument>;

function pixelArtDocument(file: PixelArtFile): PixelDocument;

const RUNTIME_COMPONENTS: RuntimeComponentPackage;
```

- `RUNTIME_COMPONENTS` declares no component and one loader, for
  `PIXEL_ART_DOCUMENT`. It reads the `.pixelart` file and returns a
  `PixelDocument` with its pixels, UV regions, palette and normal map.
- A loader whose asset references a texture, such as the voxel model's, loads it
  through `context.assets` with `PIXEL_ART_DOCUMENT`: the coordinator matches
  loaders by `AssetType` instance, so another `AssetType` of kind `pixelart`
  fails.
- `pixelArtDocument(file)` builds the same document from a parsed file, for a
  kind that embeds one, such as a blockset.
- The document draws to a canvas, so it needs a DOM.
