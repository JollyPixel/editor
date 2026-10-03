# TilesetAtlases

The loaded atlas textures of a view, keyed by tileset id, exposed as
[`view.atlases`](../core/VoxelView.md). It reads the document's
[`TilesetList`](./tilesets.md#tilesetlist); a declared tileset may have no
atlas yet.

```ts
document.tilesets.add(definition);
view.atlases.registerTexture(definition.id, texture);

const uv = view.atlases.get(definition.id)?.uvFor(0, 0);
```

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `tilesets` | `TilesetList` | The declared tilesets. Never changed by `TilesetAtlases`. |
| `defaultTilesetId` | `string \| null` | First declared id, used by tile references without a `tilesetId`. |
| `version` | `number` | Increases when an atlas or the list changes. |

## Methods

#### `registerTexture(tilesetId: string, texture: TilesetTexture, normal?: TilesetNormalTexture | null): TilesetAtlas`

Builds the atlas of a declared tileset. Throws when the id is not declared;
[`view.loadTileset()`](../core/VoxelView.md) declares and registers in one
call. Registering an id again replaces its atlas and disposes the textures the
new one does not reuse. `normal` is an optional
[normal atlas](./TilesetAtlas.md#normal-atlas).

#### `get(tilesetId?: string): TilesetAtlas | undefined`

The atlas of a tileset, or of the default tileset when `tilesetId` is omitted.
`undefined` when it has no atlas.

#### `atlas(tilesetId?: string): TilesetAtlas`

Same lookup; throws instead of returning `undefined`.

#### `dispose(): void`

Disposes every texture, normal textures included. The tileset list is left
as it is.

## Missing tileset

Voxels whose tileset is not declared, for example after it was removed, are
drawn with a red 16×16 tile crossed in white. Their faces use the reserved id
`MISSING_TILESET_ID` (`"$missing"`), which is also the `tilesetId` a
[material customizer](../../concepts/rendering-and-meshing.md#material-customizers)
receives for them. `TilesetList.add()` refuses that id.

A declared tileset without a texture is different: its faces are not drawn
until a texture is registered.
