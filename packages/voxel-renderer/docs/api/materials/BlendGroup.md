# BlendGroup

A blend group decides how the top and bottom faces of a block fade into
neighbouring blocks. A block joins a group through
[`BlockDefinition.blendGroup`](../blocks/BlockDefinition.md). Blocks of the
same group never blend with each other; they blend with the blocks of every
other group, unless one of the two groups excludes the other. Ungrouped blocks
never blend.

Groups are stored in the [tileset document](../tilesets/TilesetDocument.md)
next to `blocks`; a world receives them projected under
`"<tilesetId>/<groupId>"`, exclusions included.

```ts
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";

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

```ts
type BlendPattern = "noise" | "bayer";

interface BlendGroupJSON {
  id: string;
  width?: number;
  pattern?: BlendPattern;
  priority?: number;
  exclude?: string[];
}

type BlendGroupSettings = Required<Omit<BlendGroupJSON, "id">>;

class BlendGroup {
  static readonly defaults: Readonly<Omit<BlendGroupSettings, "exclude">>;
  static parse(value: unknown): BlendGroup | null;

  constructor(json: BlendGroupJSON);
  readonly id: string;
  readonly width: number;
  readonly pattern: BlendPattern;
  readonly priority: number;
  readonly exclude: readonly string[];

  bleedOnto(face: BlendGroup): number;
  with(settings: Partial<BlendGroupSettings>): BlendGroup;
  equals(other: BlendGroup): boolean;
  toJSON(): Required<BlendGroupJSON>;
}
```

| Field | Default | Bounds |
|---|---|---|
| `id` | Required | Non-empty string, matching `BlockDefinition.blendGroup`. |
| `width` | `8` | Integer from `1` to `64`, in texels of the face's tile. |
| `pattern` | `"noise"` | `"noise"` or `"bayer"`. |
| `priority` | `0` | Any integer. |
| `exclude` | `[]` | Non-empty group IDs; duplicates are dropped. |

The instance and its `exclude` array are frozen. The constructor throws
`RangeError` for an invalid value; `parse()` returns `null` instead. `with()`
returns a new group.

`bleedOnto(face)` returns how strongly this group bleeds onto a face of
`face`: `0` for the same group, an exclusion in either direction or a lower
priority, `0.5` for an equal priority, and `1` for a higher priority.

## Rendering

Each texel of a blended face shows either its own tile or a neighbour's tile
for the same face, never a mix. A neighbour's pull fades from one texel past
the shared edge to `width` texels further into the face, and is compared
against a threshold:

- `"noise"`: value noise sampled along the shared edge, so the border wavers
  along it without breaking into specks. A few 2x2 clumps of the neighbour's
  tile land up to two texels past the border. On an equal-priority edge both
  faces read the same noise from opposite sides, so the border stays
  continuous across it.
- `"bayer"`: a 4x4 ordered dither.

The neighbour's pattern and width apply. With equal priorities both blocks
reach into each other at the edge; a higher priority always covers the
texels beside the edge and pushes further, while the lower group does not
bleed back.

Where the two tiles meet, the higher one's border texels are darkened as an
outline, and a lower texel with the higher tile on its `-x` or `-z` side is
shaded as a cast shadow. On an equal-priority edge the group whose
id sorts first counts as the higher one.

A neighbour takes part when it is one of the eight cells around the face in
the face's plane, is opaque, has a matching face in the same atlas, and that
face is not covered. Neighbours in other tilesets never blend. Faces drawn
with the flat far material skip blending.

Defining or removing a group rebuilds every chunk.

## BlendGroupList

`VoxelDocument.blendGroups` and `TilesetDocument.blendGroups` hold the groups
of a document.

```ts
class BlendGroupList implements Iterable<BlendGroup> {
  constructor(groups?: Iterable<unknown>);
  readonly version: number;
  readonly size: number;

  has(groupId: string): boolean;
  get(groupId: string): BlendGroup | undefined;
  define(group: BlendGroup | BlendGroupJSON): boolean;
  apply(command: VoxelBlendGroupCommand): VoxelBlendGroupCommand | null;
  remove(groupId: string): boolean;
  replace(groups: Iterable<unknown>): void;
  clear(): void;
  toJSON(): BlendGroupJSON[];
}
```

`define()` returns `false` for an invalid group or one equal to the current
definition. `replace()` and the constructor skip invalid entries and keep the
first of duplicate IDs. Mutating the list directly emits no command; use
`document.defineBlendGroup()` for an edit that should sync.

## Commands

`apply()` applies a `blend-group-defined` or `blend-group-removed`
[command](../core/commands.md#blend-group-commands) to the list without
emitting it. It returns the command as applied, a defined group with every
field filled in, or `null` when the list did not change.
