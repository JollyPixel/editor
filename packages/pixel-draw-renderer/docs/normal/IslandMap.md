# IslandMap

Splits a texture into islands, the areas normal generation never samples across. In an atlas, the pixel across a tile edge belongs to another tile, so each tile face is its own island.

```ts
const islands = IslandMap.fromRegions(doc.size(), doc.uv.regions);
const island = islands.islandAt(3, 5);
```

## Construction

```ts
static fromRegions(size: Vec2, regions: Iterable<UVRegion>): IslandMap;
static fromFaces(size: Vec2, faces: Iterable<IslandFace>): IslandMap;

interface IslandFace {
  regionId: string;
  geometry: UVGeometry;
}
```

`fromRegions` uses the active slot geometry of every region, regardless of view visibility, as the UV clip does. `fromFaces` takes faces from any other source, such as a voxel block projection.

A pixel belongs to a face when its center is inside the geometry. Rects, triangles and compounds are supported.

1. Faces whose pixels overlap merge into one island.
2. Faces that only touch stay separate.
3. Pixels covered by no face form one remainder island. A texture with no faces is one island.

## Properties

```ts
readonly size: Readonly<Vec2>;
readonly islands: readonly Island[];
readonly indices: Int32Array;
readonly remainder: Island | null;

interface Island {
  readonly index: number;
  readonly regionIds: ReadonlySet<string>;
  readonly bounds: Readonly<SelectionRect>;
  readonly pixelCount: number;
  readonly isRect: boolean;
  readonly isRemainder: boolean;
}
```

`indices` holds the island index of every pixel, row-major. It is shared, not copied: do not write to it. `isRect` is `true` when every face of the island is the same rect, which is when `border: "wrap"` applies. The remainder island, when present, is last.

## Queries

```ts
islandAt(x: number, y: number): Island | null;
islandsOf(regionId: string): Island[];
islandsWithin(rect: SelectionRect): Island[];
```

`islandAt` returns `null` outside the texture. `islandsWithin` returns the islands owning at least one pixel of `rect`, by index.
