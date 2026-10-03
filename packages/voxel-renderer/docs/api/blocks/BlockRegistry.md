# BlockRegistry

Maps block ids to [resolved definitions](./BlockDefinition.md#resolvedblockdefinition).
A document's registry is
[`VoxelDocument.blocks`](../core/VoxelDocument.md#properties).

```ts
const registry = new BlockRegistry();
registry.register({ id: 1, name: "Stone", shapeId: "cube" });
registry.get(1)?.name; // "Stone"
```

## API

```ts
class BlockRegistry implements Iterable<ResolvedBlockDefinition> {
  readonly size: number;
  readonly nextId: number;
  readonly version: number;

  constructor(definitions?: BlockDefinition[]);
  register(definition: BlockDefinition): this;
  registerMany(
    definitions: Iterable<BlockDefinition>,
    options?: { skipExisting?: boolean; }
  ): this;
  unregister(id: number): boolean;
  clear(): void;
  moveTo(id: number, toIndex: number): boolean;
  indexOf(id: number): number;
  get(id: number): ResolvedBlockDefinition | undefined;
  propertiesOf(id: number): BlockProperties | undefined;
  has(id: number): boolean;
  getAll(): IterableIterator<ResolvedBlockDefinition>;
}
```

Edit a document's blocks with `defineBlock()`, `removeBlock()` and
`moveBlock()` on [`VoxelDocument`](../core/VoxelDocument.md#methods), which
emit [block commands](../core/commands.md). The registry's own methods emit
nothing.

## Writing

`register()` resolves the definition and replaces any block with the same id,
keeping its position. It throws for `AIR_BLOCK_ID` and for invalid surface
settings.

`registerMany()` registers each definition. With `skipExisting: true`, a block
already registered under that id is kept.

`unregister()` returns whether the id was registered. `clear()` removes every
block. Ids are never reused: `nextId` stays one above the highest id ever
registered.

`version` increases on every registration, including one that only changes
`properties`.

## Reading

`get()` returns the stored definition, not a copy. Treat it as read-only.

`propertiesOf()` returns a copy of the block's custom properties, `{}` for a
block without any, and `undefined` for an unknown id.

## Ordering

Blocks keep registration order, and iteration, `getAll()` and
[`TilesetDocument.toJSON()`](../tilesets/TilesetDocument.md) follow it.

`moveTo()` moves a block to `toIndex`, clamped to the list. It returns `false`
for an unknown id or a move that changes nothing. `indexOf()` returns `-1` for
an unknown id. Order has no effect on rendering.

## Creating blocks from a tileset

```ts
type TilesetGridSource = {
  cols: number;
  rows: number;
  id?: string;
  slot?: number;
};

interface BlocksFromTilesetOptions {
  limit?: number;
  map?: (blockId: number, col: number, row: number) => BlockOverrides;
}

type BlockOverrides = Partial<Pick<
  ResolvedBlockDefinition,
  | "name"
  | "shapeId"
  | "collidable"
  | "alphaMode"
  | "side"
  | "alphaCutoff"
  | "materialGroup"
  | "blendGroup"
  | "cullCoveredFaces"
  | "properties"
>>;

function blocksFromTileset(
  source: TilesetGridSource,
  options?: BlocksFromTilesetOptions
): IterableIterator<ResolvedBlockDefinition>;
```

Yields one cube block per tile, in row-major order, with local ids starting at
`1`. `limit` is the highest local id generated, `255` by default. With an `id`,
the tile references name that tileset; with a `slot`, block ids are composed
into it. `map` receives the local id and returns overrides. Generated blocks
are not collidable unless `map` says so.

```ts
document.blocks.registerMany(
  blocksFromTileset({ id: "terrain", cols: 8, rows: 4 }, {
    limit: 32,
    map: () => ({ collidable: true })
  })
);
```
