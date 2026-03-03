# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

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

## TilesetManager

Manages tileset textures and UV lookup. Accessible via `VoxelRenderer.tilesetManager`.

### Properties

```ts
readonly defaultTilesetId: string | null; // ID of the first registered tileset
```

### Methods

#### `loadTileset(def: TilesetDefinition, loader?: THREE.TextureLoader): Promise<void>`

Loads an atlas image. The first loaded tileset becomes the default.
A `THREE.TextureLoader` is created internally if `loader` is omitted.

#### `registerTexture(def: TilesetDefinition, texture: THREE.Texture): void`

Registers an already-loaded `THREE.Texture`. Useful in tests or server-side contexts.
Auto-derives `cols` and `rows` from the image dimensions if they are not set on `def`.

#### `getTileUV(ref: TileRef): TilesetUVRegion`

Computes atlas UV coordinates for the tile at `(col, row)`.
Throws if no tileset is loaded or the referenced ID is unknown.

#### `getTexture(tilesetId?: string): THREE.Texture | undefined`

Returns the shared texture for a tileset. Defaults to `defaultTilesetId`.

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
is constructed. Pass the populated loader via `VoxelRendererOptions.tilesetLoader` so all
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

const loader = new TilesetLoader({ manager: assetManager.context.manager });
await loader.fromWorld(snapshot);                           // pre-load every tileset
await loader.fromTileDefinition(defaultTilesetDef);        // idempotent if already loaded

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
vr.load(snapshot);                                         // fully synchronous
```
