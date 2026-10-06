# BlendGroup

Decides how the top and bottom faces of a block fade into neighbouring blocks.
A block joins a group through
[`BlockDefinition.blendGroup`](../blocks/BlockDefinition.md). Blocks of the
same group never blend with each other; they blend with blocks of any other
group unless one of the two groups excludes the other. Ungrouped blocks never
blend.

Groups belong to a [blockset document](../blocksets/BlocksetDocument.md) and
reach a world as `"<blocksetId>/<groupId>"`, exclusions included.

```ts
const document = new VoxelDocument({
  blocks: [
    { id: 1, name: "Grass", shapeId: "cube", defaultTexture: grass, blendGroup: "grass" },
    { id: 2, name: "Dirt", shapeId: "cube", defaultTexture: dirt, blendGroup: "dirt" }
  ],
  blendGroups: [
    { id: "grass", width: 12 },
    { id: "dirt", width: 8 }
  ]
});

document.defineBlendGroup({ id: "snow", width: 16, priority: 1 });
```

## Fields

`BlendGroupJSON` holds the fields below; every field but `id` is optional.

| Field | Default | Bounds |
| --- | --- | --- |
| `id` | Required | Non-empty string. |
| `width` | `8` | Integer from `1` to `64`: how far, in texels, a neighbour reaches into the face. |
| `pattern` | `"noise"` | `"noise"` (a wavering edge) or `"bayer"` (a 4×4 ordered dither). |
| `priority` | `0` | Any integer. |
| `exclude` | `[]` | Group ids this group never blends with. Duplicates are dropped. |

`BlendGroup.defaults` holds the defaults.

## What it looks like

- Each texel shows its own tile or the neighbour's tile, never a mix. The
  neighbour's `pattern` and `width` apply.
- A higher `priority` covers the edge and reaches into the lower face, which
  does not reach back. Equal priorities reach into each other.
- Where two tiles meet, the higher one gets a darker outline and casts a short
  shadow towards `+x` and `+z`.
- Only opaque neighbours in the same blockset blend. Distant faces drawn with
  [flat colours](../../concepts/rendering-and-meshing.md#far-distance) do not.

## BlendGroup

An immutable, validated group. The constructor throws a `RangeError` for an
invalid value.

#### `BlendGroup.parse(value: unknown): BlendGroup | null`

Like the constructor, but returns `null` for invalid input.

#### `with(settings: Partial<BlendGroupSettings>): BlendGroup`

A copy with other settings.

#### `equals(other: BlendGroup): boolean`

#### `toJSON(): Required<BlendGroupJSON>`

`document.blendGroups` is a `BlendGroupList`; see
[group lists](./MaterialGroup.md#group-lists).
