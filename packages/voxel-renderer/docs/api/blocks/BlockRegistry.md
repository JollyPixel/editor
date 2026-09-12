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

  constructor(definitions?: BlockDefinition[]);
  register(definition: BlockDefinition): this;
  registerMany(
    definitions: Iterable<BlockDefinition>,
    options?: BlockRegisterManyOptions
  ): this;
  unregister(id: number): boolean;
  clear(): void;
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
