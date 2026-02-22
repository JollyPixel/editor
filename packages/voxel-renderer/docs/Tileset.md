# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

```ts
const vr = new VoxelRenderer({});

await vr.loadTileset({
  id: "default",
  src: "assets/tileset.png",
  tileSize: 16
  // cols and rows are optional — derived from the image at load time
});

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

#### `dispose(): void`

Disposes all textures and materials and clears the registry.
