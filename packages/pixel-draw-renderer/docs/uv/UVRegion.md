# UVRegion

A texture region mapped onto a mesh. Either **collapsed** (one rect shared by every face) or **uncollapsed** (an independent rect per face).

Regions are **immutable**: `collapse()`, `uncollapse()` and `withRect()` return a new instance, or `this` when the call changes nothing. [`UVMap`](./UVMap.md) owns the store and is the only thing that turns a returned instance into an event, a history entry and a network broadcast — so mutating a region in place would bypass all three.

```ts
type UVFace = "front" | "back" | "left" | "right" | "top" | "bottom";

const UV_FACES: readonly UVFace[];  // fixed iteration order

new UVRegion(data: UVRegionData)
UVRegion.from(value: UVRegion | UVRegionData): UVRegion
```

`UVFace` names are **labels, not axes**. This is a 2D library with no camera and no axis convention; binding `"front"` to a direction is the consumer's job. The demo and voxel-map both use `front: +Z, back: -Z, left: -X, right: +X, top: +Y, bottom: -Y`.

## `UVRegionData`

The serializable form — what crosses the network, sits in history entries, and appears in a `PixelBufferSnapshot`.

```ts
type UVTriangle = {
  shape: "triangle";
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rect: SelectionRect;
};
type UVGeometry = SelectionRect | UVTriangle;

type UVRegionData =
  | { id: string; name?: string; color: string; state?: "collapsed"; rect: SelectionRect }
  | { id: string; name?: string; color: string; state: "uncollapsed";
      faces: Record<UVFace, UVGeometry>; activeFaces?: UVFace[] };
```

`state` is optional on the collapsed arm, so payloads predating multi-face support (`{ id, rect, color }`) still parse. `UVRegion.from()` accepts an existing instance unchanged, so a caller holding either shape needs no branch.

`name` is optional and immutable with the rest of the region. When present, it is preserved through geometry/state changes, history entries, network commands and snapshots.

Triangles are right triangles within `rect`; `corner` identifies their right-angle corner. `activeFaces` represents absent geometry (such as a ramp's open front); omitting it keeps every face active for compatibility.

## Properties

| Property | Type |
|---|---|
| `id` | `string` |
| `name` | `string \| undefined` — optional human-readable label |
| `color` | `string` — CSS color for the overlay border; its casing and selected tint derive from it |
| `state` | `"collapsed" \| "uncollapsed"` |

## Methods

### `rectFor(face)`

```ts
rectFor(face: UVFace): SelectionRect
```

The rect `face` samples. A collapsed region returns its single rect for **every** face, so this never needs a state check.

### `geometryFor(face)`

```ts
geometryFor(face: UVFace): UVGeometry
```

Returns the face's rectangle or triangle.

### `facesOf()`

```ts
facesOf(): { face: UVFace | null; geometry: UVGeometry }[]
```

Every active geometry the region carries: one entry with `face: null` when collapsed, otherwise active faces in `UV_FACES` order. This is what hit-testing and rendering iterate.

### `uncollapse()`

```ts
uncollapse(): UVRegion
```

Gives every face its own rect, all equal to the current one — so uncollapsing **never changes what the mesh looks like**. Returns `this` if already uncollapsed.

### `collapse(face?)`

```ts
collapse(face: UVFace = "front"): UVRegion
```

Keeps `face`'s rectangle and discards the other faces. When the chosen face is triangular, collapse prefers another active rectangle. Lossy; `UVMap` records the full previous region so undo can restore them. Returns `this` if already collapsed.

### `withRect(rect, face?)`

```ts
withRect(rect: SelectionRect, face?: UVFace): UVRegion
```

Replaces one face's rect, or the shared rect when collapsed (`face` is then irrelevant and ignored).

Returns `this` unchanged when uncollapsed and `face` is omitted: moving every face at once is not supported yet. The signature reserves that meaning — `face: null` already travels through the event, history and wire formats.

### `toJSON()`

```ts
toJSON(): UVRegionData
```

Returns copies, so mutating the result cannot reach back into the region. Called implicitly by `JSON.stringify`.
