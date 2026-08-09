# UVRegion

An immutable texture region mapped onto a mesh. A collapsed region shares one rectangle across every face. An uncollapsed region carries geometry for each active face.

```ts
new UVRegion(data: UVRegionData)
UVRegion.from(value: UVRegion | UVRegionData): UVRegion
```

`UVRegion.from()` returns an existing instance unchanged or builds one from serialized data. Geometry returned by the region is copied, so callers cannot mutate the stored state.

## Types

```ts
type UVFace =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

const UV_FACES: readonly UVFace[];

type UVTriangle = {
  shape: "triangle";
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rect: SelectionRect;
};

type UVGeometry = SelectionRect | UVTriangle;

type UVRegionData =
  | {
      id: string;
      name?: string;
      color: string;
      state?: "collapsed";
      rect: SelectionRect;
      faces?: Record<UVFace, UVGeometry>;
      activeFaces?: UVFace[];
    }
  | {
      id: string;
      name?: string;
      color: string;
      state: "uncollapsed";
      faces: Record<UVFace, UVGeometry>;
      activeFaces?: UVFace[];
    };
```

`state` remains optional for collapsed payloads created before multi-face support. Collapsed regions use optional `faces` and `activeFaces` to retain custom topology for a later uncollapse.

`activeFaces` defaults to all six faces and is normalized to `UV_FACES` order. A triangle occupies the half of `rect` containing the named right-angle corner.

Face names are labels. The consumer decides how `"front"`, `"top"` and the other names map onto mesh axes.

## Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Stable region identifier. |
| `name` | `string \| undefined` | Optional display label. |
| `color` | `string` | CSS color used by the UV overlay. |
| `state` | `"collapsed" \| "uncollapsed"` | Current geometry mode. |

## Methods

### `rectFor(face)`

```ts
rectFor(face: UVFace): SelectionRect
```

Returns a copy of the rectangle sampled by `face`. Every face resolves to the shared rectangle when collapsed.

### `geometryFor(face)`

```ts
geometryFor(face: UVFace): UVGeometry
```

Returns a copy of the face's rectangle or triangle. A collapsed region always returns its shared rectangle.

### `facesOf()`

```ts
facesOf(): { face: UVFace | null; geometry: UVGeometry }[]
```

Returns copied geometry in `UV_FACES` order. A collapsed region returns one entry with `face: null`; an uncollapsed region returns its active faces.

### `uncollapse()`

```ts
uncollapse(): UVRegion
```

Restores retained faces and shapes, placing every geometry at the shared rectangle. Returns `this` when already uncollapsed.

### `collapse(face?)`

```ts
collapse(face: UVFace = "front"): UVRegion
```

Uses the selected face's rectangle as the shared rectangle. A triangular face falls back to the first active rectangle when available. Face topology is retained, but the previous per-face layout is not restored by a later `uncollapse()`.

### `withRect(rect, face?)`

```ts
withRect(rect: SelectionRect, face?: UVFace): UVRegion
```

Replaces the shared rectangle when collapsed or one face's bounds when uncollapsed. It returns `this` when an uncollapsed region has no `face`.

### `toJSON()`

```ts
toJSON(): UVRegionData
```

Returns an independent serializable copy. `JSON.stringify()` calls it automatically.
