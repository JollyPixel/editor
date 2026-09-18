# BlockTextures

`BlockTextures` is the texture mapping of a resolved block: its `faceTextures`
and `defaultTexture`. It is an immutable view built from a
[`ResolvedBlockDefinition`](./BlockDefinition.md). The block itself stays a
plain object, so it can be serialized and sent in commands.

```ts
type TileRefMapper = (ref: ResolvedTileRef) => ResolvedTileRef;

class BlockTextures implements Iterable<ResolvedTileRef> {
  static of(block: ResolvedBlockDefinition): BlockTextures;

  readonly faceTextures: Readonly<Record<string, ResolvedTileRef>>;
  readonly defaultTexture: ResolvedTileRef | undefined;

  constructor(
    faceTextures: Readonly<Record<string, ResolvedTileRef>>,
    defaultTexture?: ResolvedTileRef
  );
  [Symbol.iterator](): IterableIterator<ResolvedTileRef>;
  forSlot(slot: string): ResolvedTileRef | undefined;
  spanFor(slot: string, span: Readonly<TileSpan>): Readonly<TileSpan>;
  tilesetIds(): string[];
  map(mapper: TileRefMapper): BlockTextures;
  withTileset(tilesetId: string | null): BlockTextures;
  applyTo(block: ResolvedBlockDefinition): ResolvedBlockDefinition;
}
```

`of()` reads the block's own objects without copying them. The instance is
frozen; treat the records it holds as read-only.

## Reading

Iteration yields every face reference, then `defaultTexture`.

`forSlot()` resolves the reference a [shape slot](./shapeSlots.md) samples: the
exact slot, then its base slot (`top` for `top.1`), then `defaultTexture`.

`spanFor()` returns `span` when the slot or its base slot has its own face
texture, and `{ u: 1, v: 1 }` otherwise. A tile shared through `defaultTexture`
stays one square tile on every face, so a ramp slope samples its true length
only from a tile of its own.

`tilesetIds()` returns the distinct explicit tileset IDs in iteration order.

## Transforming

`map()` applies `mapper` to every reference. It returns the same instance when
`mapper` returned each reference unchanged.

`withTileset()` fills `tilesetId` on references that lack one. A `null` ID
returns the same instance.

`applyTo()` returns `block` with these textures. It returns `block` itself when
the textures are the ones `of(block)` read, and otherwise a copy that omits
`defaultTexture` when there is none.

```ts
const textures = BlockTextures.of(block);
const tile = textures.forSlot("top.1");

const assigned = textures
  .withTileset(engine.tilesets.defaultTilesetId)
  .applyTo(block);
```
