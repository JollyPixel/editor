# MarqueeBox

`MarqueeBox` is an empty, axis-aligned box drawn as twelve edges with a two-color dash pattern that travels along them. It marks a 3D selection. It extends `THREE.Object3D` and has no fill, so it never hides what it surrounds.

```ts
import { MarqueeBox } from "@jolly-pixel/three";

const marquee = new MarqueeBox({
  position: { x: 4, y: 0, z: -2 },
  size: { x: 6, y: 3, z: 3 }
});

scene.add(marquee);
```

`position` is the **min corner**, as for [`AreaBox`](./AreaBox.md). `size` rebuilds the unrotated edges without changing `scale`. Use [`BoxControls`](./BoxControls.md) for pointer movement and resizing.

Rendering requires `THREE.WebGPURenderer`. The pattern moves on its own once the renderer runs through `setAnimationLoop()`. A loop that calls `render()` by hand leaves it frozen.

## Constructor

```ts
new MarqueeBox(options?: MarqueeBoxOptions)
```

```ts
type MarqueeColors = readonly [
  THREE.ColorRepresentation,
  THREE.ColorRepresentation
];

interface MarqueeBoxOptions {
  size?: THREE.Vector3Like;
  position?: THREE.Vector3Like;
  width?: number;
  dashLength?: number;
  ratio?: number;
  speed?: number;
  colors?: MarqueeColors;
  xray?: boolean;
}
```

`MarqueeBox.Defaults` stores the shared style defaults. Mutations affect new instances process-wide.

| Option | Default | Description |
|---|---:|---|
| `size` | `{ x: 1, y: 1, z: 1 }` | Extent in world units. Each axis is clamped to a strictly positive value. |
| `position` | `{ x: 0, y: 0, z: 0 }` | Min corner, in parent space. |
| `width` | `2` | Line width in CSS pixels, constant at any camera distance. |
| `dashLength` | `0.5` | World length of one dash plus one gap. |
| `ratio` | `0.5` | Share of `dashLength` drawn in the dash color, clamped to `0`-`1`. |
| `speed` | `1.5` | Dash lengths travelled per second. `0` freezes the pattern, a negative value reverses it. |
| `colors` | `["#ffffff", "#000000"]` | Dash color, then gap color. |
| `xray` | `false` | Draws the edges through other geometry. |

`dashLength` is a target. The top and bottom rings round it so their perimeter holds a whole number of dashes, and each vertical edge does the same over its height. The pattern therefore closes without a seam at the ring corners, and the real dash length drifts slightly from the requested one on sizes it does not divide.

Dashes are sized in world units, so they shrink with distance. Once they fall below a pixel the two colors blend into their mix instead of shimmering.

## Properties

### `size`

```ts
get size(): THREE.Vector3
set size(size: THREE.Vector3Like)
```

World-unit extent. The getter returns a **copy**. Assigning rewrites the edge buffers in place, so it is safe on every frame of a drag.

### `min`

```ts
get min(): THREE.Vector3
```

Alias of `position`. Mutate it directly to move the box.

### `state`

```ts
get state(): BoxState
set state(state: BoxState)
```

One of `"idle" | "hovered" | "active"`. `BoxControls` assigns `"active"` on attach and `"idle"` on detach. The marquee draws every state the same way.

### `edges`

```ts
readonly edges: MarqueeBoxEdges
```

The rendered line mesh. It carries the live style:

```ts
marquee.edges.width = 3;
marquee.edges.dashLength = 1;
marquee.edges.ratio = 0.3;
marquee.edges.speed = 0;
marquee.edges.colors = ["#ffd400", "#1a1a1a"];
marquee.edges.xray = true;
```

Every setter applies without rebuilding the material. `colors` returns copies. Changing `speed` keeps the current pattern position, so it never jumps.

## Methods

| Method | Description |
|---|---|
| `copySizeTo(target?: THREE.Vector3)` | Copies the size into `target` and returns it, without allocating when a target is passed. |
| `toBox3(target?: THREE.Box3)` | Writes the box bounds, in parent space, into `target` and returns it. |
| `fromBox3(box: THREE.Box3)` | Moves and resizes the marquee to match `box`. |
| `dispose()` | Releases the edge geometry and material. Safe to call twice. |
