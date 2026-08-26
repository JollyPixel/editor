# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

Atlases are also **repacked with a gutter** before being bound to a material — see
[Atlas padding](#atlas-padding).

```ts
// Pre-load tilesets using TilesetLoader, then pass the loader to VoxelRenderer.
const loader = new TilesetLoader();
await loader.fromTileDefinition({
  id: "default",
  src: "assets/tileset.png",
  tileSize: 16
  // cols and rows are optional — derived from the image at load time
});

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });

// Tile at column 2, row 0 — uses the default tileset
const tileRef: TileRef = {
  col: 2,
  row: 0
};

// Tile from a secondary tileset
const decorTile: TileRef = {
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

## TileRef

References a specific tile in an atlas by grid position.

```ts
interface TileRef {
  col: number;
  row: number;
  // omit to use the default (first loaded) tileset
  tilesetId?: string;
}
```

## TilesetUVRegion

Precomputed UV atlas region returned by `TilesetManager.getTileUV()`.

```ts
/**
 * Precomputed UV region for a specific tile in the atlas. 
 **/
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
covered pixel **once, at the pixel centre** — which sits outside the triangle when
only some samples are covered. The UV varying is then extrapolated past the tile and
samples whatever sits next to it in the atlas. Without a gutter, distant geometry
picks up speckles of unrelated tiles: white dots where a bright tile is adjacent,
dark moiré bands where a dark one is. The further away, the smaller each quad is on
screen, so the share of partially covered pixels — and the artifact — grows.

The gutter makes that overshoot land on a copy of the tile's own edge instead.
Measured on the `noise-world` example (8px tiles, lake surface at mid distance):

| `padding` | atlas | pixels sampling a wrong tile |
|---|---|---|
| 0 | 32×16 | 26.9% |
| 2 | 48×24 | 2.5% |
| 4 (default for 8px tiles) | 64×32 | 0% |

`padding` defaults to **half the tile size, clamped to 2..8** — the overshoot grows
with `tileSize`, so a fixed gutter would not protect larger tiles equally. Override it
per engine with `VoxelEngineOptions.tilesetPadding`, or set `0` to render atlases
untouched:

```ts
const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesetLoader,
  // 0 disables repacking entirely
  tilesetPadding: 4
});
```

Consequences to be aware of:

- The repacked texture is `(tileSize + 2 * padding)` per cell, so a 16px-tile atlas
  at the default padding is **4× the texture memory**. Atlases are small; this is
  usually negligible.
- `getTexture()` returns the **padded** atlas and always matches `getTileUV()`.
  Editing tools must use `getSourceTexture()` / `updateSourceImage()` /
  `updateSourceRegion()` instead — those address the original pixel grid that
  `tileSize` describes.
- Repacking needs a 2D canvas. Where none exists (Node, SSR), the atlas is rendered
  unpadded and UVs collapse to the raw layout — no error, just no protection.

## TilesetManager

Manages tileset textures and UV lookup. Accessible via `VoxelEngine.tilesetManager` (`vr.engine.tilesetManager`).

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

#### `loadTileset(def: TilesetDefinition, loader?: THREE.TextureLoader): Promise<void>`

Loads an atlas image. The first loaded tileset becomes the default.
A `THREE.TextureLoader` is created internally if `loader` is omitted.

#### `registerTexture(def: TilesetDefinition, texture: THREE.Texture): void`

Registers an already-loaded `THREE.Texture`. Useful in tests or server-side contexts.
Auto-derives `cols` and `rows` from the image dimensions if they are not set on `def`,
then repacks the atlas with its gutter (see [Atlas padding](#atlas-padding)).

#### `getTileUV(ref: TileRef): TilesetUVRegion`

Computes atlas UV coordinates for the tile at `(col, row)`, in the padded layout.
Throws if no tileset is loaded or the referenced ID is unknown.

#### `getTexture(tilesetId?: string): THREE.Texture | undefined`

Returns the texture bound to materials — the gutter-padded atlas when padding is
active. Always consistent with `getTileUV()`. Defaults to `defaultTilesetId`.

#### `getSourceTexture(tilesetId?: string): THREE.Texture | undefined`

Returns the atlas **as registered**, before padding. Its pixel grid is the one
`TilesetDefinition.tileSize` describes, so editing tools should read this one.
Defaults to `defaultTilesetId`.

#### `updateSourceImage(image: TilesetImage, tilesetId?: string): void`

Replaces a tileset's source image — e.g. after a texture editor writes back a canvas —
and re-pads it. The image must keep the atlas dimensions the tileset was registered
with. Both textures are updated in place, so materials holding the render texture stay
valid. A no-op for an unknown tileset.

```ts
const { tilesetManager } = vr.engine;

// read the editable grid
editor.texture = tilesetManager.getSourceTexture()!.image as HTMLImageElement;

// push edits back; the gutter is rebuilt for you
tilesetManager.updateSourceImage(editor.textureCanvas());
```

#### `updateSourceRegion(image: TilesetImage, bounds: AtlasRegion, tilesetId?: string): void`

Same, but rebuilds the gutter for only the tiles `bounds` covers. `bounds` is
`{ x, y, width, height }` in source-atlas texels — structurally the pixel editor's
`SelectionRect`.

Use this for a live editor stream. `updateSourceImage` redraws the nine-slice for every
tile in the atlas: at 2048px and `tileSize` 16 that is 128×128 tiles, roughly 147 000
`drawImage` calls, which no per-frame budget survives. A brush stroke touches one to
four tiles, so this issues 9 to 36 instead.

`updateSourceImage` remains the path for anything that changes the atlas wholesale —
snapshots, resizes, tileset switches — and this method falls back to it when the padded
atlas is not a canvas it can draw into.

A rectangle ending exactly on a tile boundary stops at the tile before it, so bounds
covering texels 0..15 of a 16px grid repad tile 0 alone.

```ts
// once per frame, from the editor's accumulated dirty rectangle
const dirty = bridge.consume();
if (dirty !== null) {
  tilesetManager.updateSourceRegion(editor.textureCanvas(), dirty);
}
```

#### `getDefinitions(): Array<TilesetDefinition & { cols: number; rows: number }>`

Returns all registered tileset definitions with `cols` and `rows` resolved from the image.

#### `getDefaultBlocks(tilesetId: string | null, options?: TilesetDefaultBlockOptions): BlockDefinition[]`

Returns a default Array of `BlockDefinition` mapped to the given **tilesetId** (or default one if not provided).

```ts
interface TilesetDefaultBlockOptions {
  /**
   * Maximum block ID to generate (inclusive).
   * @default 255.
   **/
  limit?: number;
  /**
   * Function to map block IDs to custom block definitions.
   */
  map?: (blockId: number, col: number, row: number) => Omit<BlockDefinition, "id">;
}
```

#### `dispose(): void`

Disposes all textures and materials and clears the registry.

## TilesetLoader

Pre-loading utility that fetches tileset textures asynchronously before a `VoxelRenderer`
(or a standalone `VoxelEngine`) is constructed. Pass the populated loader via
`VoxelEngineOptions.tilesetLoader` so all
textures register synchronously during construction — no async code is needed inside
lifecycle methods (`awake`, `start`, `update`).

### TilesetLoaderOptions

```ts
interface TilesetLoaderOptions {
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

### Properties

```ts
readonly tilesets: Map<string, TilesetEntry>;
```

Map from tileset ID to `{ def: TilesetDefinition, texture: THREE.Texture<HTMLImageElement> }`.
Populated by `fromTileDefinition` and `fromWorld`.

### Methods

#### `fromTileDefinition(def: TilesetDefinition): Promise<void>`

Loads the atlas image at `def.src` and stores the result in `tilesets`. Idempotent —
calling with the same `def.id` a second time is a no-op (the loader is not invoked again).

#### `fromWorld(data: VoxelWorldJSON): Promise<void>`

Iterates `data.tilesets` and calls `fromTileDefinition` for each. Useful when restoring a
saved world before constructing `VoxelRenderer`.

### Usage examples

**Single tileset:**

```ts
const loader = new TilesetLoader();
await loader.fromTileDefinition({ id: "default", src: "tileset.png", tileSize: 16 });

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
```

**Restoring a saved world (multi-tileset):**

```ts
const snapshot = JSON.parse(localStorage.getItem("world")!);

const loader = new TilesetLoader({ manager: runtime.manager });
await loader.fromWorld(snapshot);
await loader.fromTileDefinition(defaultTilesetDef);

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
vr.engine.load(snapshot);
```

Prepare the loader in runtime bootstrap code, before requesting the scene. The
scene can then construct `VoxelRenderer` and restore the snapshot synchronously.
