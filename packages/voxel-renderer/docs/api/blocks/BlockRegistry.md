# BlockRegistry

`BlockRegistry` maps numeric block IDs to resolved block definitions.
`VoxelEngine.blockRegistry` exposes the engine's registry.

## API

```ts
interface BlockRegisterManyOptions {
  skipExisting?: boolean;
}

class BlockRegistry implements Iterable<ResolvedBlockDefinition> {
  readonly nextId: number;
  readonly version: number;
  readonly size: number;

  constructor(definitions?: BlockDefinition[]);
  register(definition: BlockDefinition): this;
  registerMany(
    definitions: Iterable<BlockDefinition>,
    options?: BlockRegisterManyOptions
  ): this;
  unregister(id: number): boolean;
  clear(): void;
  moveTo(id: number, toIndex: number): boolean;
  indexOf(id: number): number;
  get(id: number): ResolvedBlockDefinition | undefined;
  propertiesOf(id: number): BlockProperties | undefined;
  has(id: number): boolean;
  getAll(): IterableIterator<ResolvedBlockDefinition>;
  [Symbol.iterator](): IterableIterator<ResolvedBlockDefinition>;
}
```

`register()` resolves the definition and replaces any definition already using
the ID. It throws for `AIR_BLOCK_ID`.

`registerMany()` applies the same operation to each input. With
`skipExisting: true`, an existing local definition wins. This is used when a
saved document or converter output embeds block definitions.

`unregister()` drops the definition and reports whether one was there.
`clear()` drops every definition. Neither lowers `nextId`: an ID is never
recycled, so a removed ID cannot later name a different block while a peer
still references it.

## Ordering

The registry keeps definitions in registration order, not ID order, and every
traversal (, iteration, serialization) follows it. That order is what
[](../serialization/serialization.md) writes to the
document's  array and what  restores when a document is
loaded, so a chosen order survives a save.

 on an ID already present keeps that block's position, so editing a
definition never moves it.

 relocates a block to , clamping out-of-range values to the
first or last position. It returns  for an unknown ID and for a move that
would leave the order unchanged, and only bumps  when it returns
. The order carries no rendering meaning: moving a block never
invalidates compiled geometry.

 returns a block's current position, or  when it is unknown.
 is the number of registered definitions.

## Ordering

The registry keeps definitions in registration order, not ID order, and every
traversal (`getAll()`, iteration, serialization) follows it. That order is what
[`serializeVoxelWorld()`](../serialization/serialization.md) writes to the
document's `blocks` array and what `registerMany()` restores when a document is
loaded, so a chosen order survives a save.

`register()` on an ID already present keeps that block's position, so editing a
definition never moves it.

`moveTo()` relocates a block to `toIndex`, clamping an out-of-range value to
the first or last position. It returns `false` for an unknown ID and for a move
that would leave the order unchanged, and only bumps `version` when it returns
`true`. The order carries no rendering meaning: moving a block never
invalidates compiled geometry.

`indexOf()` returns a block's current position, or `-1` when it is unknown.
`size` is the number of registered definitions.

`nextId` is one above the highest ID ever registered. It never returns `0` and
does not reuse gaps. It is not clamped to `MAX_BLOCK_ID`; packing a larger ID
fails when the voxel is written.

`version` increments for each completed registration. Geometry caches use it to
detect stale compiled block data. It rises for any registration, including one
that only changes [custom properties](./BlockDefinition.md#custom-properties),
so a property-only edit still invalidates compiled geometry.

`get()` returns the stored definition, not a copy. It is called once per voxel
on the collision path, so treat the result as read-only; mutating it corrupts
the registry and skips the resolution rules.

`propertiesOf()` returns a fresh copy of a block's custom properties, which the
caller owns and may mutate. It returns `undefined` for an unregistered ID, and
an empty object for a block that has none. Use
[`VoxelEngine.blockPropertiesAt()`](../core/VoxelEngine.md#blockpropertiesatposition-threevector3like-blockproperties--undefined)
to look them up by world position instead of by ID.

## Creating blocks from a tileset

`blocksFromTileset()` creates one cube block for each tile in a resolved atlas.
IDs start at `1` and follow row-major order.

```ts
interface BlocksFromTilesetOptions {
  limit?: number;
  map?: (
    blockId: number,
    col: number,
    row: number
  ) => BlockOverrides;
}

type BlockOverrides = Partial<
  Pick<
    ResolvedBlockDefinition,
    | "name"
    | "shapeId"
    | "collidable"
    | "alphaMode"
    | "side"
    | "alphaCutoff"
    | "cullSelfFaces"
    | "properties"
  >
>;

function blocksFromTileset(
  definition: ResolvedTilesetDefinition,
  options?: BlocksFromTilesetOptions
): IterableIterator<ResolvedBlockDefinition>;
```

`limit` defaults to 255 and is inclusive. Generated blocks default to
`collidable: false`; use `map` when the atlas represents solid terrain.

```ts
const definition = engine.tilesetManager.atlas().def;

engine.blockRegistry.registerMany(
  blocksFromTileset(definition, {
    limit: 32,
    map: () => ({ collidable: true })
  })
);
```
