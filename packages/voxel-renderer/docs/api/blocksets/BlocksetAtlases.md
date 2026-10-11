# BlocksetAtlases

The loaded atlas textures of a view, keyed by blockset id, exposed as
[`view.atlases`](../core/VoxelView.md). It reads the document's
[`BlocksetList`](./blocksets.md#blocksetlist); a declared blockset may have no
atlas yet.

```ts
document.blocksets.add(definition);
view.atlases.registerTexture(definition.id, texture);

const uv = view.atlases.get(definition.id)?.computeTileUvRegion(0, 0);
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `blocksets` | `BlocksetList` | The declared blocksets. Never changed by `BlocksetAtlases`. |
| `defaultBlocksetId` | `string \| null` | First declared id, used by tile references without a `blocksetId`. |
| `version` | `number` | Increases when an atlas or the list changes. |

## Methods

#### `registerTexture(blocksetId: string, texture: AtlasTexture, normal?: AtlasNormalTexture | null): BlocksetAtlas`

Builds the atlas of a declared blockset. Throws when the id is not declared;
[`view.loadBlockset()`](../core/VoxelView.md) declares and registers in one
call. Registering an id again replaces its atlas and disposes the textures the
new one does not reuse. `normal` is an optional
[normal atlas](./BlocksetAtlas.md#normal-atlas).

#### `get(blocksetId?: string): BlocksetAtlas | undefined`

The atlas of a blockset, or of the default blockset when `blocksetId` is omitted.
`undefined` when it has no atlas.

#### `requireLoadedAtlas(blocksetId?: string): BlocksetAtlas`

Same lookup; throws instead of returning `undefined`.

#### `resolveAtlas(blocksetId?: string): BlocksetAtlas | MissingBlocksetAtlas | undefined`

Returns the loaded atlas, or the missing-texture atlas when the id is undeclared.
A declared blockset without a loaded texture returns `undefined`.

#### `dispose(): void`

Disposes every texture, normal textures included. The blockset list is left
as it is.

## Missing blockset

Voxels whose blockset is not declared, for example after it was removed, are
drawn with a red 16×16 tile crossed in white. Their faces use the reserved id
`MISSING_BLOCKSET_ID` (`"$missing"`), which is also the `blocksetId` a
[material customizer](../../concepts/rendering-and-meshing.md#material-customizers)
receives for them. `BlocksetList.add()` refuses that id.

A declared blockset without a texture is different: its faces are not drawn
until a texture is registered.
