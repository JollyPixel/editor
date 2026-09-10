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
  properties?: BlockProperties;
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

## Custom properties

```ts
type BlockProperties = Record<string, string | number | boolean>;
```

`properties` carries arbitrary data for game code: script behavior, physics
tuning, anything the renderer itself does not read. Nothing in the meshing,
collision, or texturing path looks at it.

```ts
registry.register({
  id: 1,
  name: "Ice",
  shapeId: "cube",
  properties: {
    friction: 0.02,
    material: "ice",
    slippery: true
  }
});
```

Values are limited to `string`, `boolean`, and finite `number`. Anything else,
including nested objects, arrays, `null`, `undefined`, `NaN`, and `Infinity`, is
dropped when the definition is resolved, as is a `__proto__` key. The limit
holds for definitions arriving from a saved document or a remote peer, so a
hostile payload cannot smuggle a nested value or reach the prototype chain.
Resolved definitions always carry a `properties` map, empty when none were
authored.

Because values are flat scalars, a copy is shallow and cheap. Read them with
[`BlockRegistry.propertiesOf()`](./BlockRegistry.md) or, keyed by a world
position, with [`VoxelEngine.blockPropertiesAt()`](../core/VoxelEngine.md).

## ResolvedBlockDefinition

`BlockRegistry` stores resolved definitions. Defaults have been applied, tuple
tile references have been expanded, and `defaultTilesetId` is no longer present.

```ts
type ResolvedBlockDefinition =
  & Omit<
    BlockDefinition,
    | "faceTextures"
    | "defaultTexture"
    | "collidable"
    | "defaultTilesetId"
    | "properties"
  >
  & {
    faceTextures: Record<string, ResolvedTileRef>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
    properties: BlockProperties;
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
