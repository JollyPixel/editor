# Tilesets

Tileset definitions describe atlas images. `loadTilesets()` fetches those
images, [`TilesetManager`](./TilesetManager.md) registers them, and
[`TilesetAtlas`](./TilesetAtlas.md) provides the texture and UV data used by
materials, through an [`AtlasLayout`](./AtlasLayout.md).

## Definitions and tile references

```ts
interface TilesetDefinition {
  id: string;
  src: string;
  tileSize: number;
  cols?: number;
  rows?: number;
}

type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

function resolveTilesetDefinition(
  definition: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition;
```

Tiles are square and `tileSize` is measured in pixels. Missing row and column
counts are derived from the image dimensions. Partial tiles at an image edge
are excluded by flooring the result. Explicit counts are preserved.

```ts
interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
}

type Coords = [col: number, row: number];
type TileRef = Coords | ResolvedTileRef;

function resolveTileRef(
  reference: TileRef,
  defaultTilesetId?: string
): ResolvedTileRef;
```

A missing `tilesetId` selects the first registered tileset. `resolveTileRef()`
expands tuple references and fills the default ID without mutating the input.

The supporting texture and atlas types are:

```ts
interface AtlasSize {
  width: number;
  height: number;
}

interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

type TilesetImage = HTMLImageElement | HTMLCanvasElement;
type TilesetTexture = THREE.Texture<TilesetImage>;
```

## Loading textures

Use `loadTilesets()` before constructing a `VoxelEngine` or `VoxelRenderer`.

```ts
interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

interface TextureSourceLoader {
  loadAsync(
    url: string
  ): Promise<THREE.Texture<HTMLImageElement>>;
}

interface LoadTilesetsOptions {
  manager?: THREE.LoadingManager;
  loader?: TextureSourceLoader;
}

function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options?: LoadTilesetsOptions
): Promise<TilesetSource[]>;
```

Definitions are fetched in parallel. A duplicate ID is fetched once. The
optional `manager` reports Three.js loading progress; `loader` allows callers
to supply a compatible texture loader. Pass the result through
`VoxelEngineOptions.tilesets`.

The [loading and restoring tilesets guide](../../guides/loading-and-restoring-tilesets.md)
shows initial loading and saved-world restoration.

## Classes

- [`TilesetManager`](./TilesetManager.md) registers loaded atlas textures.
- [`TilesetAtlas`](./TilesetAtlas.md) owns one atlas and its two textures.
- [`AtlasLayout`](./AtlasLayout.md) is the tile grid, padded and unpadded.
