# MaterialGroup

A surface finish (roughness, metalness, emission) shared by every block whose
[`BlockSurface`](../blocks/BlockSurface.md) names it in `materialGroup`. Groups
belong to a [tileset document](../tilesets/TilesetDocument.md) and reach a
world as `"<tilesetId>/<groupId>"`; a `VoxelDocument` can also define its own.

```ts
const document = new VoxelDocument({
  blocks: [
    { id: 1, name: "Gold", shapeId: "cube", defaultTexture, materialGroup: "gold" }
  ],
  materialGroups: [
    { id: "gold", roughness: 0.35, metalness: 1 }
  ]
});

document.defineMaterialGroup({ id: "gold", roughness: 0.2, metalness: 1 });
```

## Fields

`MaterialGroupJSON` holds the fields below; every field but `id` is optional.

| Field | Default | Bounds |
| --- | --- | --- |
| `id` | Required | Non-empty string. |
| `roughness` | `1` | `0` to `1`. |
| `metalness` | `0` | `0` to `1`. |
| `emissive` | `"#000000"` | A `#rrggbb` colour, stored in lower case. |
| `emissiveIntensity` | `1` | `0` or more. |
| `normalScale` | `1` | `0` or more. Strength of the tileset's [normal atlas](../../concepts/rendering-and-meshing.md#normal-maps); `0` turns it off. |

`MaterialGroup.defaults` holds the defaults.

## Rendering

A block whose group is defined is drawn with a `MeshStandardMaterial` carrying
the finish, even when the view uses `"lambert"`. Other blocks, including those
naming an undefined group, keep the view's material. A
[material customizer](../../concepts/rendering-and-meshing.md#material-customizers)
runs after the finish is applied, and not again when the finish is edited
later.

A metallic finish reflects `scene.environment`; without one, a metalness near
`1` renders dark.

## MaterialGroup

An immutable, validated group. The constructor throws a `RangeError` for a
value out of bounds.

#### `MaterialGroup.parse(value: unknown): MaterialGroup | null`

Like the constructor, but returns `null` for invalid input.

#### `with(finish: Partial<MaterialGroupFinish>): MaterialGroup`

A copy with other finish values.

#### `applyTo(material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial): void`

Writes the finish to a material, for example a block preview. A Lambert
material only receives the emissive fields and `normalScale`.

#### `equals(other: MaterialGroup): boolean`

#### `toJSON(): Required<MaterialGroupJSON>`

## Group lists

`document.materialGroups` is a `MaterialGroupList` and `document.blendGroups`
a `BlendGroupList`, on both `VoxelDocument` and `TilesetDocument`. Both lists
share these members:

| Member | Description |
| --- | --- |
| `size` | Number of groups. |
| `version` | Increases on every change. |
| `has(id)`, `get(id)` | Lookups. The list is also iterable. |
| `define(group)` | Adds or replaces a group. `false` for an invalid group or one equal to the current definition. |
| `remove(id)` | `false` for an unknown group. |
| `replace(groups)`, `clear()` | `replace()` skips invalid entries and keeps the first of duplicated ids. |
| `toJSON()` | The groups as JSON. |

`MaterialGroupList` also has `ids()`. Changing a list directly emits no
command; use `document.defineMaterialGroup()`, `removeMaterialGroup()`,
`defineBlendGroup()` and `removeBlendGroup()` for edits that should reach
peers. They emit the [commands](../core/commands.md) `material-group-defined`,
`material-group-removed`, `blend-group-defined` and `blend-group-removed`.
