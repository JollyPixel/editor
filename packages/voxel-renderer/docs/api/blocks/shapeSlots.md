# Shape slots

A texture slot is the unit a block's `faceTextures` is keyed by. Every polygon
of a shape belongs to exactly one slot, and every slot samples one tile.

For a cube each face carries one polygon, so the six slots are the six face
names and nothing changes from keying by face directly. Shapes that emit several
polygons into one face need the distinction: a `stair` has ten polygons across
six faces.

```ts
function shapeSlots(shape: BlockShape): readonly ShapeSlot[];

interface ShapeSlot {
  id: string;
  face: Face;
  definitions: readonly FaceDefinition[];
  span: Readonly<TileSpan>;
}
```

`shapeSlots()` is memoized per shape, so the returned array may be compared by
identity.

`span` is the [face span](./BlockShape.md#slanted-faces) shared by the slot's
polygons, or `{ u: 1, v: 1 }` when they disagree.

## Slot keys

```ts
const FACE_SLOT_NAMES: readonly ["right", "left", "top", "bottom", "front", "back"];

type FaceSlotName = typeof FACE_SLOT_NAMES[number];
type TextureSlotKey =
  | FaceSlotName
  | `${FaceSlotName}.${number}`
  | Face
  | (string & {});

function slotNameOf(face: Face): FaceSlotName;
function slotKeyOf(key: string): string;
function unknownTextureSlots(
  keys: Iterable<string>,
  shape: BlockShape
): string[];
```

`TextureSlotKey` types the keys of `faceTextures`. It stays open to any string
because a shape may [pin](#pinning-a-slot) a slot under a name of its own, so
the type gives completion but does not reject a typo such as `negY`.

`slotKeyOf()` reads a numeric `Face` key as that face's slot and returns any
other key unchanged.

`unknownTextureSlots()` returns the keys that cannot texture any polygon of
`shape`. A key is known when it is one of the shape's slots, the base of one, or
a built-in face slot name. The last rule lets one texture map serve a cube and a
`ramp`, which has no `back` slot. When a view builds a block, it logs a
warning through its `logger` for each block whose keys are unknown. The warning
is logged once per registration of that block.

## How a slot is derived

Polygons of one face are grouped by their supporting plane. Coplanar polygons
describe a single surface and share a slot; polygons on different planes are
repeated features and take a slot each.

The group on the boundary plane, the one at `0` or `1` along the face's axis,
takes the bare face name. Every plane further in takes the next free suffix,
ordered by distance inward. A polygon that is not planar on its face axis, such
as the slope of a ramp, is its own group.

A `stair` therefore yields eight slots:

| Slot | Polygons |
|---|---|
| `bottom`, `front` | one each |
| `right`, `left` | two coplanar quads each, an L-shaped coverage |
| `top`, `top.1` | the upper platform, then the tread below it |
| `back`, `back.1` | the low end face, then the riser behind it |

`stairCornerInner` and `stairCornerOuter` yield nine each. Every other built-in
shape has one polygon per face and yields the six, or fewer, bare names.

## Slot footprints

A slot keeps the projection its polygons were authored with, and never stretches
to fill its tile. A polygon covering half its face covers half its tile, so its
texture keeps the aspect the shape gives it: a stair's `top` takes the same
half-height band of a tile that a `slab` side does, and a `pole` cap keeps the
middle of its own.

The slots of one face therefore tile that face without overlapping. A stair's
`top` and `top.1` take the two halves of a tile, so pointing both at one tile
renders exactly what a stair rendered before slots existed.

## Pinning a slot

A `FaceDefinition` may name its slot, which overrides the plane rule. Polygons
naming the same slot share a tile whatever planes they lie on.

```ts
defineFace({
  face: Face.PosY,
  normal: [0, 1, 0],
  vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0]],
  slot: "top"
});
```

`RampCornerInner` uses this: its slope and the flat triangle above it meet along
an edge and read as one surface, so both are pinned to `top` rather than being
split by the plane rule.

Pinning is also how a shape keeps a slot id stable. Slot ids are derived from
geometry, so moving a polygon's plane renames its slot and drops blocks using it
back to `defaultTexture`; naming the slot explicitly prevents that.
