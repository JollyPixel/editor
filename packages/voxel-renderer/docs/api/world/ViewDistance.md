# ViewDistance

Immutable chunk radius around the view's focus. Chunks outside it are not
meshed. Set it with `range.viewDistance` in the
[`VoxelView` options](../core/VoxelView.md#view-distance) or on `view.range`.

```ts
import { ViewDistance } from "@jolly-pixel/voxel.renderer";

view.range.viewDistance = new ViewDistance({
  chunks: 12,
  shape: "sphere",
  hysteresis: 2
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `chunks` | `number` | `Infinity` | Radius in chunks, measured from the focus to a chunk center. |
| `shape` | `"xz" \| "sphere"` | `"xz"` | `"xz"` ignores height; `"sphere"` includes it. |
| `hysteresis` | `number` | `1` | Extra chunks a visible chunk may drift before it leaves the view. |

A negative or `NaN` `chunks` or `hysteresis` throws a `RangeError`.

## Properties

`chunks`, `shape` and `hysteresis` are read-only. `unlimited` is `true` when
`chunks` is `Infinity`.

## Static members

#### `ViewDistance.Unlimited`

The instance a view starts with.

#### `ViewDistance.from(value: number | ViewDistanceOptions | ViewDistance): ViewDistance`

A number is a radius in chunks. An instance is returned as is.

## Methods

#### `equals(other: ViewDistance): boolean`

Compares by value.
