# UVRegion

An immutable texture region mapped onto a mesh. A collapsed region shares one rectangle across every face. An uncollapsed region carries geometry for each active face.

```ts
new UVRegion(data: UVRegionData)
UVRegion.from(value: UVRegion | UVRegionData): UVRegion
```

`UVRegion.from()` returns an existing instance unchanged or builds one from serialized data. Geometry returned by the region is copied, so callers cannot mutate the stored state.

## Types
```ts
type UVSlot = string;

// The six default names of a box; a shape may name further slots.
const UV_FACES: readonly UVSlot[];

type UVTriangle = {
  shape: "triangle";
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rect: SelectionRect;
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
};

type UVGeometry = SelectionRect | UVTriangle | UVCompound;

type UVRegionData =
  | {
      id: string;
      name?: string;
      color: string;
      state?: "collapsed";
      rect: SelectionRect;
      faces?: Record<UVSlot, UVGeometry>;
      activeFaces?: UVSlot[];
      collapsedFace?: UVSlot;
    }
  | {
      id: string;
      name?: string;
      color: string;
      state: "uncollapsed";
      faces: Record<UVSlot, UVGeometry>;
      activeFaces?: UVSlot[];
    };
```

`state` remains optional for collapsed payloads created before multi-face support. Collapsed regions use optional `faces` and `activeFaces` to retain custom topology for a later uncollapse, and `collapsedFace` records which face `rect` was taken from. A payload may still place those faces away from `rect`, in which case `uncollapse()` restores them around it; `collapse()` itself writes them stacked on `rect`.

`activeFaces` defaults to the slots `faces` carries, keeps the order it was given, and drops any slot the region has no geometry for. A triangle occupies the half of `rect` containing the named right-angle corner. A compound covers the union of its `parts`, each positioned in the `0` to `1` space of `rect` so parts scale with it. Normalized parts must remain inside that space and have positive dimensions. The area no part covers, such as the notch of an L, is outside the region.

Slot names are labels. The consumer decides how `"front"`, `"top"` and any further slot map onto mesh geometry; `@jolly-pixel/voxel.renderer` derives them from a shape and may emit names like `"top.1"`.

## Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Stable region identifier. |
| `name` | `string \| undefined` | Optional display label. |
| `color` | `string` | CSS color used by the UV overlay. |
| `state` | `"collapsed" \| "uncollapsed"` | Current geometry mode. |
| `faces` | `readonly UVSlot[]` | Every slot the region carries geometry for, active or not. |

## Methods

### `rectFor(face)`

```ts
rectFor(face: UVSlot): SelectionRect
```

Returns a copy of the rectangle sampled by `face`. Every face resolves to the shared rectangle when collapsed.

### `geometryFor(face)`

```ts
geometryFor(face: UVSlot): UVGeometry
```

Returns a copy of the slot's geometry. A collapsed region always returns its shared rectangle.

### `facesOf()`

```ts
facesOf(): { face: UVSlot | null; geometry: UVGeometry }[]
```

Returns copied geometry in the region's own slot order. A collapsed region returns one entry with `face: null`; an uncollapsed region returns its active slots.

### `uncollapse()`

```ts
uncollapse(): UVRegion
```

Restores retained faces and shapes onto the shared rectangle, each keeping the size and shape its slot carries. A face collapsed by this class holds no offset of its own, so uncollapsing a region restarts from its current rectangle however far it moved while collapsed. Returns `this` when already uncollapsed.

### `collapse(face?)`

```ts
collapse(face?: UVSlot): UVRegion
```

Uses the largest active face's rectangle as the shared rectangle, so a partial slot such as a stair's tread never becomes the region's footprint. `face` only picks between equally large ones, and a rectangle wins over a triangle or a compound at the same size. Face topology is retained, but per-face positions are not: every slot is stacked on the shared rectangle, so a later `uncollapse()` restarts from it.

### `withRect(rect, face?)`

```ts
withRect(rect: SelectionRect, face?: UVSlot): UVRegion
```

Replaces the shared rectangle when collapsed or one face's bounds when uncollapsed. It returns `this` when an uncollapsed region has no `face`.

### `toJSON()`

```ts
toJSON(): UVRegionData
```

Returns an independent serializable copy. `JSON.stringify()` calls it automatically.
