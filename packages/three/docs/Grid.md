# Grid

An infinite, camera-following ground-plane grid mesh, using screen-space-derivative
anti-aliased lines with two-level LOD blending (fine cell grid + coarse section
grid) and axis highlighting. Implements the technique from
[Bgolus's "The Best Darn Grid Shader (Yet)"](https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8),
built with TSL.

```ts
import { Grid } from "@jolly-pixel/three";

const grid = new Grid({
  cell: { size: 1 },
  section: { size: 10 }
});
scene.add(grid); // self-updating: no manual .update() call needed
```

Rendering notes:

- Requires `THREE.WebGPURenderer` and a `NodeMaterial`-capable pipeline (TSL). Not usable with `THREE.WebGLRenderer`.
- `frustumCulled` is always `false` because the mesh follows the camera every frame.
- The underlying material has `transparent: true` and `depthWrite: false`.


## GridOptions

```ts
export interface GridCellOptions {
  /**
   * Fine grid style.
   * @default "lines"
   */
  style?: GridStyle;
  /**
   * Cell size.
   * @default 1
   */
  size?: number;
  /**
   * Cell color.
   * @default "#393939"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Fine grid line width, in pixels.
   * @default 1
   */
  thickness?: number;
}

export interface GridSectionOptions {
  /**
   * Section grid style.
   * @default "lines"
   */
  style?: GridStyle;
  /**
   * Cells per section line.
   * @default 10
   */
  size?: number;
  /**
   * Section color.
   * @default "#787878"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Section grid line width, in pixels.
   * @default 2
   */
  thickness?: number;
}

export interface GridAxesOptions {
  /**
   * Whether axis lines are drawn.
   * @default true
   */
  show?: boolean;
  /**
   * Axis line width, in pixels.
   * @default 2
   */
  thickness?: number;
  /**
   * X-axis color.
   * @default "#e54b4b"
   */
  xColor?: THREE.ColorRepresentation;
  /**
   * Y-axis color.
   * @default "#4bc94b"
   */
  yColor?: THREE.ColorRepresentation;
  /**
   * Z-axis color.
   * @default "#4b7bc9"
   */
  zColor?: THREE.ColorRepresentation;
}

export interface GridOptions {
  /**
   * Grid plane.
   * @default "xz"
   */
  plane?: GridPlane;
  /**
   * Camera-following quad edge length.
   * @default Math.max(fadeDistance * 4, 200)
   */
  extent?: number;
  /**
   * Fine cell grid options.
   */
  cell?: GridCellOptions;
  /**
   * Coarse section grid options.
   */
  section?: GridSectionOptions;
  /**
   * Half-arm length for `"cross"` style, as a fraction of a cell (0-0.5).
   * Ignored when both grid styles are `"lines"`.
   * @default 0.2
   */
  crossSize?: number;
  /**
   * Fades out the fine cell grid over the cell straddling each section
   * line — otherwise a `"cross"` cell style pokes its arms out past a
   * section line at every intersection the two share.
   * @default false
   */
  hideCellOnSection?: boolean;
  /**
   * Width, in cells, of the `hideCellOnSection` fade-out ramp for a
   * `"lines"` cell style — larger values fade out earlier and over more
   * cells. Clamped to half a section. Ignored for a `"cross"` cell style,
   * which always uses a hard cutoff.
   * @default 0.5
   */
  hideCellOnSectionFadeWidth?: number;
  /**
   * Fade-out distance.
   * @default 100
   */
  fadeDistance?: number;
  /**
   * Fade falloff exponent.
   * @default 1
   */
  fadeStrength?: number;
  /**
   * Axis-line options.
   */
  axes?: GridAxesOptions;
  /**
   * Offset along the plane normal.
   * @default 0
   */
  offset?: number;
  /**
   * Whether the grid is visible. Backed by `THREE.Object3D.visible`; exposed
   * here under a domain-appropriate name for editor on/off toggles.
   * @default true
   */
  enabled?: boolean;
}
```

## Properties

```ts
class Grid extends THREE.Mesh {
  readonly plane: GridPlaneValue;
  readonly cellStyle: GridStyleValue;
  readonly sectionStyle: GridStyleValue;
  readonly cellColor: GridColor;
  readonly sectionColor: GridColor;
  readonly xAxisColor: GridColor;
  readonly yAxisColor: GridColor;
  readonly zAxisColor: GridColor;

  cellSize: number;
  sectionSize: number;
  cellThickness: number;
  sectionThickness: number;
  crossSize: number;
  hideCellOnSection: boolean;
  hideCellOnSectionFadeWidth: number;
  fadeDistance: number;
  fadeStrength: number;
  showAxes: boolean;
  axisThickness: number;
  offset: number;
  enabled: boolean;
}

class GridPlaneValue {
  readonly value: "xz" | "xy" | "yz";
  orientGeometry(
    geometry: THREE.PlaneGeometry
  ): void;
  followPosition(
    cameraPosition,
    normalOffset
  ): Vector3Like;
}

class GridStyleValue {
  readonly value: "lines" | "cross";
}

class GridColor {
  // normalized hex, e.g. "#393939";
  // settable with any THREE.ColorRepresentation
  value: string;
}
```

## Usage notes

- `plane`, `cellStyle`, and `sectionStyle` are fixed at construction time. To change them, create a new `Grid`.
- Colors are edited through `.value` on each color property:

```ts
grid.cellColor.value = "#ff0000";
grid.xAxisColor.value = "#e54b4b";
```

- Most numeric/boolean properties (`cellSize`, `fadeDistance`, `showAxes`, `offset`, etc.) are live and can be updated anytime.

## Mutability at a glance

| Property | Mutable after `new Grid()` | Notes |
|---|---|---|
| `plane` | No | Set once in `new Grid({ plane })`. |
| `cellStyle`, `sectionStyle` | No | Set once in `new Grid({ cell, section })`. |
| `crossSize` | Yes | Relevant when using `"cross"` style. |
| `hideCellOnSection` | Yes | Hides/fades the fine grid near section lines. |
| `hideCellOnSectionFadeWidth` | Yes | Fade width for `"lines"` cell style. |
| `extent` | Constructor only (`GridOptions`) | Set in options only; not exposed as a live `Grid` property. |
| `xAxisColor`, `yAxisColor`, `zAxisColor` | Yes (via `.value`) | Only in-plane axes are visible. |
| `enabled` | Yes | Same as `grid.visible`. |

Everything else in the class block (`cellSize`, `sectionSize`, thickness, fade, axes visibility, `offset`) is mutable and applies immediately.
