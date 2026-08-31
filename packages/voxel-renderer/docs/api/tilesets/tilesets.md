# Tilesets

Tileset definitions describe atlas images. `loadTilesets()` fetches those
images, `TilesetManager` registers them, and `TilesetAtlas` provides the texture
and UV data used by materials.

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

interface AtlasLayout {
  cols: number;
  rows: number;
  tileSize: number;
  padding: number;
}

interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

`AtlasLayout` describes the render atlas after optional padding. `AtlasRegion`
uses source-image texels and limits an incremental repad operation.

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

## `TilesetManager`

`VoxelEngine.tilesetManager` exposes the manager used to register loaded atlas
textures.

```ts
interface TilesetManagerOptions {
  padding?: number;
}

class TilesetManager {
  readonly defaultTilesetId: string | null;
  readonly version: number;

  constructor(options?: TilesetManagerOptions);
  registerTexture(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): TilesetAtlas;
  atlas(tilesetId?: string): TilesetAtlas;
  has(tilesetId?: string): boolean;
  definitions(): ResolvedTilesetDefinition[];
  dispose(): void;
}
```

The first registered tileset becomes the default for references without a
`tilesetId`. `registerTexture()` resolves missing grid dimensions and prepares
the render atlas.

`atlas()` returns the selected atlas or the default. It throws when no tileset
is registered or the requested ID is unknown. `has()` performs the same lookup
without throwing.

`version` increments when registrations change so cached UV data can be
invalidated. `dispose()` disposes every atlas and clears the manager.

`padding` controls the gutter added around each tile. Its default is half the
tile size, clamped from 2 through 8 texels. Set it to `0` to keep source atlases
unchanged. See [atlas padding](../../concepts/atlas-padding.md).

## `TilesetAtlas`

`TilesetAtlas` owns one registered atlas, its resolved grid, and the source and
render textures. Obtain it from `TilesetManager.atlas()`.

```ts
class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly layout: AtlasLayout;
  readonly sourceTexture: TilesetTexture;
  readonly texture: TilesetTexture;

  constructor(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>,
    padding?: number | null
  );
  uvFor(col: number, row: number): TilesetUVRegion;
  updateSource(
    image: TilesetImage,
    bounds?: AtlasRegion
  ): void;
  dispose(): void;
}
```

An omitted or `null` padding value uses the default for the tile size. The
constructor applies nearest-neighbour filtering, sRGB color space, and disables
mipmap generation on the render texture.

`sourceTexture` preserves the original atlas grid used by editing tools.
`texture` is bound to materials and may contain padded cells. `uvFor()` returns
coordinates for the render texture.

`updateSource()` replaces the source image and rebuilds the padded texture. The
new image must keep the dimensions used at registration. Both texture objects
are updated in place, so existing materials stay valid.

Pass `bounds` for an editor update that changed only part of the source atlas.
The rectangle uses source texels and redraws only intersecting tiles. Omit it
for a complete replacement, resize, or tileset switch.

```ts
const atlas = engine.tilesetManager.atlas();
const dirty = bridge.consume();

if (dirty !== null) {
  atlas.updateSource(editor.textureCanvas(), dirty);
}
```

`dispose()` disposes both textures.
