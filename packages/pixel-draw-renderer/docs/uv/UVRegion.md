# UVRegion

An immutable texture region mapped onto a mesh. It holds one of three states:

| State | Face geometry | Moves as |
|---|---|---|
| `"stacked"` | one rectangle shared by every face | the whole region |
| `"unfolded"` | a packed net, one cell per active face | the whole region |
| `"free"` | a rectangle per active face | each face on its own |

```ts
new UVRegion(data: UVRegionData)
UVRegion.from(value: UVRegion | UVRegionData): UVRegion
```

`UVRegion.from()` returns an existing instance unchanged or builds one from serialized data. Geometry returned by the region is copied, so callers cannot mutate the stored state.

## Types
```ts
type UVSlot = string;

// The six default names of a box; a shape may name further slots.
const DEFAULT_UV_SLOTS: readonly UVSlot[];

// Clockwise quarter turns in texture space, where y points down.
type UVQuarterTurn = 0 | 1 | 2 | 3;

type UVRect = SelectionRect & {
  rotation?: UVQuarterTurn;
};

type UVTriangle = {
  shape: "triangle";
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rect: SelectionRect;
  rotation?: UVQuarterTurn;
};

type UVNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UVCompoundPart =
  | UVNormalizedRect
  | {
      shape: "triangle";
      corner: UVTriangle["corner"];
      rect: UVNormalizedRect;
    };

type UVCompound = {
  shape: "compound";
  rect: SelectionRect;
  parts: readonly UVCompoundPart[];
  rotation?: UVQuarterTurn;
};

type UVGeometry = UVRect | UVTriangle | UVCompound;

type UVRegionState = "stacked" | "unfolded" | "free";

type UVRegionData =
  | {
      id: string;
      name?: string;
      color: string;
      state: "stacked";
      rect: UVRect;
      faces?: Record<UVSlot, UVGeometry>;
      activeFaces?: UVSlot[];
      stackedFace?: UVSlot;
    }
  | {
      id: string;
      name?: string;
      color: string;
      state: "unfolded" | "free";
      faces: Record<UVSlot, UVGeometry>;
      activeFaces?: UVSlot[];
    };
```

`state` is required, and payloads written before the three-state rename do not load. Stacked regions use optional `faces` and `activeFaces` to retain custom topology for a later `free()` or `unfold()`, and `stackedFace` records which face `rect` was taken from. A payload may still place those faces away from `rect`, in which case `free()` restores them around it; `stack()` itself writes them onto `rect`.

`activeFaces` defaults to the slots `faces` carries, keeps the order it was given, and drops any slot the region has no geometry for. A triangle occupies the half of `rect` containing the named right-angle corner. A compound covers the union of its `parts`, each positioned in the `0` to `1` space of `rect` so parts scale with it. Normalized parts must remain inside that space and have positive dimensions. The area no part covers, such as the notch of an L, is outside the region.

A geometry is stored as it looks after rotation: a rotated rect has its width and height swapped, a triangle names the corner it now occupies, and compound parts sit where they turned to. `rotation` only tells a mesh consumer how to orient its UVs inside that rect, and is left out when it is `0`. A stacked region keeps its rotation on `rect`, shared by every slot. [`rotateUv()`](#rotateuvu-v-turns) and [`rotateCorner()`](#rotatecornercorner-turns) turn mesh UVs to match.

Slot names are labels. The consumer decides how `"front"`, `"top"` and any further slot map onto mesh geometry; `@jolly-pixel/voxel.renderer` derives them from a shape and may emit names like `"top.1"`.

## Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Stable region identifier. |
| `name` | `string \| undefined` | Optional display label. |
| `color` | `string` | CSS color used by the UV overlay. |
| `state` | `UVRegionState` | Current geometry mode. |
| `slots` | `readonly UVSlot[]` | Every slot the region carries geometry for, active or not. |
| `activeSlots` | `readonly UVSlot[]` | Active slots in consumer-defined order. |
| `movementScope` | `"region" \| "slot"` | Whether dragging moves the region or one slot. |
| `stackedFace` | `UVSlot \| null` | Slot `rect` was taken from, when stacked. |
| `bounds` | `SelectionRect` | The shared rectangle when stacked, otherwise the union of the active faces. |

## Methods

### `rectFor(slot)`

```ts
rectFor(slot: UVSlot): SelectionRect
```

Returns a copy of the rectangle sampled by `slot`. Only a free region answers per slot; a stacked or unfolded region returns `bounds` whatever slot is asked for, because it moves as one.

### `geometryFor(slot)`

```ts
geometryFor(slot: UVSlot): UVGeometry
```

Returns a copy of the slot's geometry. A stacked region always returns its shared rectangle. An unfolded region returns the cell the net gave that slot, which is what `rectFor()` will not tell you.

### `slotsOf()`

```ts
slotsOf(): { slot: UVSlot | null; geometry: UVGeometry }[]
```

Returns copied geometry in the region's own slot order. A stacked region returns one entry with `slot: null`. Unfolded and free regions both return one entry per active slot, so an overlay draws and hit-tests every cell of a net individually even though dragging any of them moves the whole region.

### `free()`

```ts
free(): UVRegion
```

Hands every face its own position. From `"unfolded"` this changes nothing but the state: the cells stay where the net put them and become individually draggable. From `"stacked"` it restores retained faces and shapes onto the shared rectangle, each keeping the size and shape its slot carries. A stacked face holds no offset of its own, so a region that moved while stacked frees at its current rectangle. Returns `this` when already free.

### `unfold()`

```ts
unfold(): UVRegion
```

Packs the active faces into a net anchored on the current `bounds` top-left. Each face keeps its own size and shape; only its position changes.

The packer places the tallest face first, then fills the lowest free spot left of the strip, so a short cell slides in beside a tall neighbour instead of starting a new row. It repeats that over every strip width a shelf packer could need and keeps the net whose bounding box has the smallest perimeter, then the smallest area. Six equal faces give a 2x3 net; a pole's two horizontal side strips end up stacked on top of each other rather than side by side, and a stair's half-height back and top slots pair into full rows.

Unfolding always repacks, whatever state it starts from, so a hand-arranged free layout is discarded. That transition is recorded as a `uv-state` history entry holding the whole previous region, so undo brings the arrangement back. The result is idempotent: unfolding a net returns `this`.

Nothing here knows about the canvas. A net larger than the texture keeps going past the edge; [`UVMap.setState()`](./UVMap.md#setstateid-state-face) is what pulls it back inside.

### `stack(slot?)`

```ts
stack(slot?: UVSlot): UVRegion
```

Uses the largest active slot's rectangle as the shared rectangle, so a partial slot such as a stair's tread never becomes the region's footprint. `slot` only picks between equally large ones, and a rectangle wins over a triangle or a compound at the same size. Slot topology is retained, but per-slot positions are not: every slot is stacked on the shared rectangle.

Stacking a net therefore lands the region on whichever cell won, which for equal-sized faces is the first one in `activeFaces` order. That is the cell the net started from, so `unfold()` followed by `stack()` returns a box region to the rectangle it began with.

When the active faces carry different rotations, the stacked region takes the most common one; a tie goes to the rotation of the slot being stacked on. Faces with another rotation are turned in place to match.

### `rotated(direction, slot?)`

```ts
rotated(direction: RotationDirection, slot?: UVSlot): UVRegion
```

Turns the region 90 degrees clockwise (`"cw"`) or counter-clockwise (`"ccw"`), keeping each rect's top-left corner:

- **stacked**: the shared rect and every slot turn together.
- **unfolded**: the whole net turns as one piece around its `bounds`, whose top-left corner stays put.
- **free**: only `slot` turns in place. Returns `this` when `slot` is missing or unknown.

Four turns return the starting geometry. Nothing here knows about the canvas; [`UVMap.rotate()`](./UVMap.md#rotateid-direction-slot) clamps the result.

### `withGeometry(slot, geometry)`

```ts
withGeometry(slot: UVSlot, geometry: UVGeometry): UVRegion
```

Replaces one slot's geometry of a free region, as a network peer does when it receives a slot rotation. Returns `this` for any other state or an unknown slot.

### `withRect(rect, face?)`

```ts
withRect(rect: SelectionRect, face?: UVSlot): UVRegion
```

Replaces the shared rectangle when stacked, or one face's bounds when free, keeping its rotation. An unfolded region translates every face by `rect` minus its current `bounds` and ignores `face` entirely. It returns `this` when a free region has no `face`.

### `translated(delta)`

```ts
translated(delta: Vec2): UVRegion
```

Moves the whole region by `delta`, in any state. Returns `this` for a zero delta.

### `toJSON()`

```ts
toJSON(): UVRegionData
```

Returns an independent serializable copy. `JSON.stringify()` calls it automatically.

## Rotation helpers

### `rotateGeometry(geometry, turns)`

```ts
rotateGeometry(geometry: UVGeometry, turns: number): UVGeometry
```

Turns a geometry clockwise by `turns` quarter turns (negative values turn counter-clockwise), keeping the top-left corner of its rect, and adds `turns` to its `rotation`.

### `rotationOf(geometry)`

```ts
rotationOf(geometry: UVGeometry): UVQuarterTurn
```

Returns the geometry's `rotation`, or `0`.

### `rotateUv(u, v, turns)`

```ts
rotateUv(u: number, v: number, turns: number): [number, number]
```

Turns a mesh UV inside the unit square, with `v` pointing up, so that it follows a clockwise texture-space rotation. After one turn the face's top edge samples the rect's right edge, which is where the overlay draws the orientation marker.

### `rotateCorner(corner, turns)`

```ts
rotateCorner(corner: UVTriangleCorner, turns: number): UVTriangleCorner
```

Turns a triangle corner clockwise. A mesh consumer recovers the corner a triangle had before rotating with `rotateCorner(corner, -rotationOf(geometry))`, applies that orientation first, then `rotateUv()`.
