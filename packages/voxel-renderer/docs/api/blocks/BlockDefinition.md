# BlockDefinition

`BlockDefinition` is the authoring form accepted by `BlockRegistry.register()`
and `VoxelEngineOptions.blocks`. Only `id`, `name`, and `shapeId` are required.

```ts
interface BlockDefinition extends BlockSurfaceOptions {
  id: number;
  name: string;
  shapeId: BlockShapeID;
  faceTextures?: Record<string, TileRef>;
  defaultTexture?: TileRef;
  collidable?: boolean;
  alphaMode?: BlockAlphaMode;
  side?: BlockSide;
  alphaCutoff?: number;
  cullSelfFaces?: boolean;
  defaultTilesetId?: string;
  properties?: BlockProperties;
}
```

`faceTextures` is keyed by texture slot, not by face. A slot missing from it
falls back to its base slot, then to `defaultTexture`, so a `"top.1"` written by
no one uses the tile of `"top"`. A numeric `Face` key is read as that face's
default slot, so definitions written before slots keep loading. `collidable`
defaults to `true`. `defaultTilesetId` fills tile references that omit a
tileset and is removed from the resolved definition.

[`BlockSurface`](./BlockSurface.md) defines `alphaMode`, `side`, and
`alphaCutoff`. Opaque blocks ignore texture alpha. Masked blocks discard
uncovered texels before applying the layer fade. Blended blocks preserve
fractional alpha and do not write depth; use
[`VoxelTransparencyRenderer`](../core/VoxelTransparencyRenderer.md) to
composite overlapping surfaces without triangle sorting.

`cullSelfFaces` defaults to `true`. Covered faces shared with another voxel
of the same block are removed, including partially overlapping double-sided
boundaries. Set it to `false` to retain the internal interface. This also
applies to opaque blocks, though their depth-tested outer faces normally hide
those interfaces.

Retained, coincident double-sided boundaries use opposing front-sided pieces,
so each viewing direction sees one appearance of the interface. Exposed pieces
remain double-sided. Separated slab surfaces remain exposed; merely sharing a
block ID does not remove them. Different block IDs retain their directional
appearances at shared transparent boundaries.

```ts
registry.register({
  id: 2,
  name: "Stained glass",
  shapeId: "cube",
  alphaMode: "blend",
  cullSelfFaces: false
});
```

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
