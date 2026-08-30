# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

Atlases are also **repacked with a gutter** before being bound to a material.
See [Atlas padding](#atlas-padding).

```ts
import {
  VoxelRenderer,
  loadTilesets,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

// Fetch the atlas textures, then hand them to VoxelRenderer.
const tilesets = await loadTilesets([
  {
    id: "default",
    src: "assets/tileset.png",
    tileSize: 16,
    // cols and rows are optional; they are derived from the image at load time
  }
]);

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesets });

// Tile at column 2, row 0. Uses the default tileset.
const tileRef: ResolvedTileRef = {
  col: 2,
  row: 0
};

// Tile from a secondary tileset
const decorTile: ResolvedTileRef = {
  col: 0,
  row: 3,
  tilesetId: "decor"
};
```

## TilesetDefinition

Describes an atlas image.

```ts
interface TilesetDefinition {
  id: string;
  src: string;
  /** Tile width/height in pixels (tiles are square) */
  tileSize: number;
  /**
   * Number of tile columns in the atlas.
   * When omitted, derived automatically from the image width
   */
  cols?: number;
  /**
   * Number of tile rows in the atlas.
   * When omitted, derived automatically from the image height
   */
  rows?: number;
}
```

## resolveTilesetDefinition

```ts
function resolveTilesetDefinition(
  def: TilesetDefinition,
  size: { width: number; height: number; }
): ResolvedTilesetDefinition;
```

Fills in `cols` and `rows` from the atlas dimensions, flooring partial tiles out
of the grid; explicit values are kept. `TilesetAtlas` applies it to a loaded
texture, and it is re-exported from
`@jolly-pixel/voxel.renderer/asset/index.ts` so a document seeded outside a
browser resolves the same grid.

## TileRef

References a specific tile in an atlas by grid position, either as an object or
as a bare `[col, row]` tuple.

```ts
interface ResolvedTileRef {
  col: number;
  row: number;
  // omit to use the default (first loaded) tileset
  tilesetId?: string;
}

type Coords = [col: number, row: number];

type TileRef = Coords | ResolvedTileRef;
```

`resolveTileRef(ref, defaultTilesetId?)` expands a tuple and fills in a missing
`tilesetId`, returning a new `ResolvedTileRef`. `BlockRegistry` stores the
resolved form, so any tile reference read back from it is a `ResolvedTileRef`.

## TilesetUVRegion

Precomputed UV atlas region returned by `TilesetAtlas.uvFor()`.

```ts
export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}
```

## Atlas padding

Every tile in an atlas is surrounded by a gutter of texels replicated from its own
border, and the atlas is repacked into a larger texture before rendering.

This exists because MSAA (`antialias: true`, the engine default) shades a partially
covered pixel **once, at the pixel centre**. That point can sit outside the triangle when
only some samples are covered. The UV varying is then extrapolated past the tile and
samples whatever sits next to it in the atlas. Without a gutter, distant geometry
picks up speckles of unrelated tiles: white dots where a bright tile is adjacent,
dark moiré bands where a dark one is. At greater distances, smaller quads put more
partially covered pixels on screen, making the artifact more visible.

The gutter makes that overshoot land on a copy of the tile's own edge instead.
Measured on the `noise-world` example (8px tiles, lake surface at mid distance):

| `padding` | atlas | pixels sampling a wrong tile |
|---|---|---|
| 0 | 32×16 | 26.9% |
| 2 | 48×24 | 2.5% |
| 4 (default for 8px tiles) | 64×32 | 0% |

`padding` defaults to **half the tile size, clamped to 2..8**. The overshoot grows
with `tileSize`, so a fixed gutter would leave larger tiles exposed. Override it
per engine with `VoxelEngineOptions.tilesetPadding`, or set `0` to render atlases
untouched:

```ts
const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesets,
  // 0 disables repacking entirely
  tilesetPadding: 4
});
```

Consequences to be aware of:

- The repacked texture is `(tileSize + 2 * padding)` per cell, so a 16px-tile atlas
  at the default padding is **4× the texture memory**. Atlases are small; this is
  usually negligible.
- `TilesetAtlas.texture` is the **padded** atlas and always matches `uvFor()`.
  Editing tools must use `sourceTexture` / `updateSource()` because those address
  the original pixel grid that `tileSize` describes.
- Repacking needs a 2D canvas. Where none exists (Node, SSR), the atlas is rendered
  unpadded, `layout.padding` is `0`, `texture` aliases `sourceTexture` and UVs
  collapse to the raw layout. Rendering continues without gutter protection.

## TilesetAtlas

One registered atlas. Owns its resolved grid, both of its textures, and the padded
canvas the render texture draws from. Obtained from
`TilesetManager.atlas(tilesetId?)`.

### Properties

```ts
// grid resolved against the atlas dimensions
readonly def: ResolvedTilesetDefinition;
// { cols, rows, tileSize, padding }; padding is 0 when repacking did not happen
readonly layout: AtlasLayout;
// the atlas as registered before padding; grid-editing tools use this texture
readonly sourceTexture: TilesetTexture;
// the atlas bound to materials, padded when layout.padding > 0
readonly texture: TilesetTexture;
```

### Methods

#### `uvFor(col: number, row: number): TilesetUVRegion`

Computes atlas UV coordinates for the tile at `(col, row)`, in the padded layout.

#### `updateSource(image: TilesetImage, bounds?: AtlasRegion): void`

Replaces the source image (for example, after a texture editor writes back a canvas)
and repads it. The image must keep the atlas dimensions used at registration.
Both textures are updated in place, so materials holding the render texture stay
valid.

`bounds` restricts the repad to the tiles the rect covers. It uses
`{ x, y, width, height }` in source-atlas texels, the same shape as the pixel
editor's `SelectionRect`. Pass it for a live editor stream: a full repad redraws the
nine-slice for every tile, and at 2048px with `tileSize` 16 that is 128×128 tiles,
roughly 147 000 `drawImage` calls, which no per-frame budget survives. A brush
stroke touches one to four tiles, so a bounded repad issues 9 to 36 instead.

A rectangle ending exactly on a tile boundary stops at the tile before it, so bounds
covering texels 0..15 of a 16px grid repad tile 0 alone.

```ts
const atlas = vr.engine.tilesetManager.atlas();

// read the editable grid
editor.texture = atlas.sourceTexture.image as HTMLImageElement;

// once per frame, from the editor's accumulated dirty rectangle
const dirty = bridge.consume();
if (dirty !== null) {
  atlas.updateSource(editor.textureCanvas(), dirty);
}

// omit bounds for anything wholesale: snapshots, resizes, tileset switches
atlas.updateSource(editor.textureCanvas());
```

#### `dispose(): void`

Disposes both textures.

## TilesetManager

Registry of loaded atlases. Accessible via `VoxelEngine.tilesetManager`
(`vr.engine.tilesetManager`).

### TilesetManagerOptions

```ts
interface TilesetManagerOptions {
  /**
   * Texels of edge-replicated gutter added around every tile when the atlas is
   * repacked for rendering. Set to 0 to render atlases as-is.
   * @default half the tile size, clamped to 2..8
   */
  padding?: number;
}
```

### Properties

```ts
readonly defaultTilesetId: string | null; // ID of the first registered tileset
// bumped whenever the registered tilesets change, invalidating precomputed UVs
readonly version: number;
```

### Methods

#### `registerTexture(def: TilesetDefinition, texture: THREE.Texture): TilesetAtlas`

Registers an already-loaded `THREE.Texture` and returns its atlas. The first
registered tileset becomes the default. Auto-derives `cols` and `rows` from the image
dimensions if they are not set on `def`, then repacks the atlas with its gutter (see
[Atlas padding](#atlas-padding)).

#### `atlas(tilesetId?: string): TilesetAtlas`

Returns the registered atlas, defaulting to `defaultTilesetId`. Throws if no tileset
is registered or the referenced ID is unknown.

#### `has(tilesetId?: string): boolean`

Returns whether the requested tileset is registered. Omitting the ID checks the
default tileset.

#### `definitions(): ResolvedTilesetDefinition[]`

Returns all registered tileset definitions with `cols` and `rows` resolved from the image.

#### `dispose(): void`

Disposes every atlas and clears the registry.

## loadTilesets

```ts
function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options?: LoadTilesetsOptions
): Promise<TilesetSource[]>;
```

Fetches atlas textures before a `VoxelRenderer` (or a standalone `VoxelEngine`) is
constructed. Pass the result via `VoxelEngineOptions.tilesets` so all textures
register synchronously during construction. No async code is needed inside
lifecycle methods (`awake`, `start`, `update`).

Definitions are fetched in parallel, and a duplicated `id` is fetched once.

```ts
interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

interface LoadTilesetsOptions {
  /**
   * Optional THREE.LoadingManager to track load progress.
   */
  manager?: THREE.LoadingManager;
  /**
   * Custom loader implementation. For testing only.
   */
  loader?: { loadAsync(url: string): Promise<THREE.Texture<HTMLImageElement>> };
}
```

### Usage examples

**Single tileset:**

```ts
const tilesets = await loadTilesets([
  { id: "default", src: "tileset.png", tileSize: 16 }
]);

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesets });
```

**Restoring a saved world (multi-tileset):**

```ts
const snapshot = JSON.parse(localStorage.getItem("world")!);

const tilesets = await loadTilesets(
  [...snapshot.tilesets, defaultTilesetDef],
  { manager: runtime.manager }
);

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesets });
vr.engine.load(snapshot);
```

`load()` throws when the snapshot names an unregistered tileset. If the renderer
already exists, fetch only the missing definitions and pass them through
`VoxelLoadOptions.tilesets`:

```ts
const missingTilesets = snapshot.tilesets.filter(
  (def) => !vr.engine.tilesetManager.has(def.id)
);

vr.engine.load(snapshot, {
  tilesets: await loadTilesets(missingTilesets)
});
```

Fetch the tilesets in runtime bootstrap code, before requesting the scene. The
scene can then construct `VoxelRenderer` and restore the snapshot synchronously.
