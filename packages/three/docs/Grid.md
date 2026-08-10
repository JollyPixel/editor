# Grid

`Grid` is a camera-following plane mesh with anti-aliased cell lines, larger section lines, axis colors, and distance fading.

```ts
import { Grid } from "@jolly-pixel/three";

const grid = new Grid({
  cell: { size: 1 },
  section: { size: 10 }
});

scene.add(grid);
```

The grid updates from `onBeforeRender`; no update call is required. It uses TSL and requires `THREE.WebGPURenderer`. Its node material is transparent, does not write depth, and cannot be rendered by `THREE.WebGLRenderer`.

## Constructor

```ts
new Grid(options?: GridOptions)
```

`Grid` extends `THREE.Mesh<THREE.PlaneGeometry>`. Constructor-only settings determine the geometry and shader branches. Live properties can be changed after construction.

## Types

```ts
type GridPlane = "xz" | "xy" | "yz";
type GridStyle = "lines" | "cross";
type GridFadeFrom = "camera" | "origin" | "target";

interface GridCellOptions {
  style?: GridStyle;
  size?: number;
  color?: THREE.ColorRepresentation;
  thickness?: number;
}

interface GridSectionOptions {
  style?: GridStyle;
  size?: number;
  color?: THREE.ColorRepresentation;
  thickness?: number;
}

interface GridFadeOptions {
  from?: GridFadeFrom;
  target?: THREE.Object3D;
  distance?: number;
  strength?: number;
}

interface GridAxesOptions {
  show?: boolean;
  thickness?: number;
  xColor?: THREE.ColorRepresentation;
  yColor?: THREE.ColorRepresentation;
  zColor?: THREE.ColorRepresentation;
}

interface GridOptions {
  plane?: GridPlane;
  extent?: number;
  cell?: GridCellOptions;
  section?: GridSectionOptions;
  crossSize?: number;
  hideCellOnSection?: boolean;
  hideCellOnSectionFadeWidth?: number;
  fade?: GridFadeOptions;
  axes?: GridAxesOptions;
  offset?: number;
  enabled?: boolean;
  followCamera?: boolean;
  infiniteGrid?: boolean;
}
```

## Geometry options

### `plane`

Sets the grid plane and defaults to `"xz"`. The remaining values create grids in the XY or YZ plane. `plane` is fixed after construction and is exposed as `grid.plane.value`.

### `extent` / `infiniteGrid`

`extent` sets the finite quad's width and height in world units. Its derived default is:

```ts
Math.max(fade.distance * Grid.Defaults.extent.fadeMultiplier,
  Grid.Defaults.extent.minimum)
```

The built-in values produce `Math.max(fade.distance * 4, 200)`.

Set `infiniteGrid: true` to draw a full-viewport grid without a visible edge. Infinite mode ignores `extent` and `followCamera`; `plane`, `offset`, and fade settings still apply. `infiniteGrid` is read-only after construction.

## Cell and section options

| Option | Default | Description |
|---|---:|---|
| `cell.style` | `"lines"` | Draws continuous lines or crosses at cell intersections. |
| `cell.size` | `1` | Fine-grid spacing in world units. |
| `cell.color` | `"#393939"` | Fine-grid color. |
| `cell.thickness` | `1` | Fine-grid width in pixels. |
| `section.style` | `"lines"` | Draws continuous section lines or crosses. |
| `section.size` | `10` | Number of cells between section lines. |
| `section.color` | `"#787878"` | Section-line color. |
| `section.thickness` | `2` | Section-line width in pixels. |
| `crossSize` | `0.2` | Cross half-length as a fraction of one cell. |
| `hideCellOnSection` | `false` | Suppresses fine lines where section lines are drawn. |
| `hideCellOnSectionFadeWidth` | `0.5` | Width of that suppression fade, in cells. Used by the `"lines"` cell style. |

Styles are fixed after construction. Sizes, colors, thicknesses, and overlap settings are live.

## Fade and positioning options

`fade.from` selects the distance-fade anchor:

| Value | Fade anchor | Default `followCamera` position |
|---|---|---|
| `"camera"` | Camera world position | Camera position projected onto the grid plane. |
| `"origin"` | Grid-plane origin | Grid-plane origin. |
| `"target"` | `fade.target` world position | Target position projected onto the grid plane. |

`fade.from` defaults to `"camera"` and is fixed after construction. `"target"` requires `fade.target`; the constructor throws when it is missing.

`fade.distance` defaults to `100` world units. `fade.strength` defaults to `1` and controls the fade curve. Both are live through `fadeDistance` and `fadeStrength`.

`followCamera` defaults to `fade.from !== "origin"`. Set it to `false` to pin a finite grid to its plane origin. It can be toggled at runtime. Infinite grids calculate world positions in the shader and ignore it.

The target is read with `getWorldPosition()` before every render, so parent transforms are included. It can be replaced or cleared at runtime:

```ts
grid.fade.target = player;
grid.fade.target = null;
```

Clearing a target makes both the fade anchor and finite-grid position fall back to the active camera.

`offset` moves the grid along its plane normal and defaults to `0`. It remains live in finite and infinite modes.

## Axis options

Axes are visible by default. `axes.thickness` defaults to `2` pixels; the X, Y, and Z colors default to `"#e54b4b"`, `"#4bc94b"`, and `"#4b7bc9"`.

Only the two axes contained by the selected plane are rendered. Axis visibility, thickness, and colors are live.

## Properties

### Layout and style

```ts
readonly plane: GridPlaneValue
readonly cellStyle: GridStyleValue
readonly sectionStyle: GridStyleValue
readonly infiniteGrid: boolean

cellSize: number
sectionSize: number
cellThickness: number
sectionThickness: number
crossSize: number
hideCellOnSection: boolean
hideCellOnSectionFadeWidth: number
axisThickness: number
offset: number
```

The read-only value objects expose their constructor setting through `.value`. The remaining properties update shader uniforms immediately.

### Colors

```ts
readonly cellColor: GridColor
readonly sectionColor: GridColor
readonly xAxisColor: GridColor
readonly yAxisColor: GridColor
readonly zAxisColor: GridColor
```

Each color is changed through its `value` property. The getter returns a normalized hexadecimal string; the setter accepts any `THREE.ColorRepresentation`.

```ts
grid.cellColor.value = "#ff0000";
grid.xAxisColor.value = new THREE.Color("#cc3333");
```

### Fade and visibility

```ts
readonly fade: GridFadeValue

fadeDistance: number
fadeStrength: number
followCamera: boolean

get enabled(): boolean
set enabled(value: boolean)
```

`fade.from` is read-only and `fade.target` is live. `enabled` is an alias for the inherited `visible` property; changing either one is reflected by the other.

`frustumCulled` is always `false`. This keeps the finite camera-following mesh and the infinite clip-space quad from being rejected using a stale world-space bounding volume.

## Global defaults

```ts
static readonly Grid.Defaults: GridDefaults
```

`Grid.Defaults` supplies every omitted constructor option. Its nested values are mutable and affect grids constructed afterward. Existing instances keep their current values.

```ts
Grid.Defaults.cell.color = "#2a2a2a";
Grid.Defaults.plane = new GridPlaneValue("xy");

const grid = new Grid();
```

The following exported interfaces describe the object:

```ts
interface GridDefaults {
  plane: GridPlaneValue;
  cell: GridCellDefaults;
  section: GridSectionDefaults;
  crossSize: number;
  hideCellOnSection: boolean;
  hideCellOnSectionFadeWidth: number;
  fade: GridFadeDefaults;
  axes: GridAxesDefaults;
  offset: number;
  enabled: boolean;
  infiniteGrid: boolean;
  extent: GridExtentDefaults;
}
```

`GridCellDefaults`, `GridSectionDefaults`, `GridFadeDefaults`, `GridAxesDefaults`, and `GridExtentDefaults` are also exported.

## Methods

### `dispose()`

```ts
dispose(): void
```

Disposes the grid geometry and every assigned material. Remove the grid from its parent separately.

## Exported value objects

`Grid` returns the following small value objects. They are exported for typed integrations and custom grid setup.

```ts
class GridColor {
  constructor(color: THREE.Color)
  get value(): string
  set value(next: THREE.ColorRepresentation)
}

class GridPlaneValue {
  constructor(value: GridPlane)
  readonly value: GridPlane
  clone(): GridPlaneValue
  orientGeometry(geometry: THREE.PlaneGeometry): void
  followPosition(
    cameraPosition: Vector3Like,
    normalOffset: number
  ): Vector3Like
}

class GridStyleValue {
  constructor(value: GridStyle, label: string)
  readonly value: GridStyle
  clone(): GridStyleValue
}

class GridFadeValue {
  constructor(from: GridFadeFrom, target?: THREE.Object3D)
  readonly from: GridFadeFrom
  target: THREE.Object3D | null
  trackTarget(
    targetPositionUniform: THREE.Vector3,
    fallbackPosition?: Vector3Like
  ): void
  anchorPosition(
    cameraPosition: Vector3Like,
    targetPositionUniform: Vector3Like
  ): Vector3Like
}
```

`GridPlaneValue` and `GridStyleValue` reject unsupported string values. `GridFadeValue` requires a target when constructed with `"target"`.
