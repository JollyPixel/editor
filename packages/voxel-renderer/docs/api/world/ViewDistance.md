# ViewDistance

Immutable chunk radius around [`VoxelEngine.focus`](../core/VoxelEngine.md#view-distance),
with separate enter and leave radii so a chunk on the border does not flip
every tick. Distances are measured in world units between the focus and a
chunk center.

## Constructor

```ts
new ViewDistance(options?: ViewDistanceOptions)

interface ViewDistanceOptions {
  /** Radius in chunks; `Infinity` keeps every chunk meshed. Default: `Infinity`. */
  chunks?: number;
  /** `"xz"` ignores the vertical axis, `"sphere"` measures it. Default: `"xz"`. */
  shape?: "xz" | "sphere";
  /** Extra radius in chunks a visible chunk keeps. Default: `1`. */
  hysteresis?: number;
}
```

A negative `chunks` or `hysteresis` throws a `RangeError`.

`ViewDistance.Unlimited` is the shared instance the engine starts with, and
`ViewDistance.from()` accepts either a radius or an options object:

```ts
ViewDistance.from(8);                    // same as new ViewDistance({ chunks: 8 })
ViewDistance.from({ chunks: 8 });
ViewDistance.from(ViewDistance.Unlimited);
```

## Properties

```ts
class ViewDistance {
  readonly chunks: number;
  readonly shape: "xz" | "sphere";
  readonly hysteresis: number;

  get unlimited(): boolean;
}
```

## Methods

#### `admits(dx: number, dy: number, dz: number, chunkSize: number): boolean`

Whether a chunk that far from the focus may enter the view. `dx`/`dy`/`dz` are
the world-space offsets from the focus to the chunk center; `dy` is ignored in
`"xz"` shape.

#### `retains(dx: number, dy: number, dz: number, chunkSize: number): boolean`

Whether a chunk already in view stays there. True everywhere `admits()` is,
plus one more `hysteresis` of drift.

#### `equals(other: ViewDistance): boolean`

Compares by value. The engine compares by identity instead, so assigning an
equal but distinct instance still triggers a visibility pass.
