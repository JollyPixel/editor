# BlockDefinition

`BlockDefinition` is the authoring form accepted by `BlockRegistry.register()`
and `VoxelEngineOptions.blocks`. Only `id`, `name`, and `shapeId` are required.

```ts
interface BlockDefinition {
  id: number;
  name: string;
  shapeId: BlockShapeID;
  faceTextures?: Record<string, TileRef>;
  defaultTexture?: TileRef;
  collidable?: boolean;
  transparent?: boolean;
  defaultTilesetId?: string;
}
```

`faceTextures` is keyed by texture slot, not by face. A slot missing from it
falls back to its base slot, then to `defaultTexture`, so a `"top.1"` written by
no one uses the tile of `"top"`. A numeric `Face` key is read as that face's
default slot, so definitions written before slots keep loading. `collidable`
defaults to `true`, and `transparent` defaults to `false`. A transparent block
does not hide the face of a neighbouring block, because its alpha holes may
reveal it. It does hide the face it shares with a neighbour holding that same
block: both copies of that face sit on one plane, so drawing them z-fights. Two
different transparent blocks keep their shared faces. `defaultTilesetId` fills
tile references that omit a tileset and is removed from the resolved definition.

```ts
registry.register({
  id: 1,
  name: "Stone",
  shapeId: "cube"
});
```

## ResolvedBlockDefinition

`BlockRegistry` stores resolved definitions. Defaults have been applied, tuple
tile references have been expanded, and `defaultTilesetId` is no longer present.

```ts
type ResolvedBlockDefinition =
  & Omit<
    BlockDefinition,
    "faceTextures" | "defaultTexture" | "collidable" | "defaultTilesetId"
  >
  & {
    faceTextures: Record<string, ResolvedTileRef>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
  };

function resolveBlockDefinition(
  definition: BlockDefinition
): ResolvedBlockDefinition;
```

`resolveBlockDefinition()` returns a new object and does not mutate the input
definition or its tile references. `BlockRegistry.register()` calls it for each
registration.

## Air

```ts
const AIR_BLOCK_ID = 0;

function isAir(blockId: number): boolean;
```

ID `0` is reserved for air and is never stored. Registering a definition with
that ID throws `Error`; packing or writing it throws `RangeError`. Remove a
voxel with `removeVoxel()` instead.

Packed reads return `VOXEL_ABSENT` for air, while object reads return
`undefined`. See [packed voxel values](../world/VoxelChunk.md#packed-voxel-values).
