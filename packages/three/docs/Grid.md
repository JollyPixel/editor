# Grid

A camera-following ground-plane grid mesh with anti-aliased lines, two-level
LOD blending (fine cells + coarse sections), and axis highlighting. Built with
TSL, based on
[Bgolus's "The Best Darn Grid Shader (Yet)"](https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8).

> [!NOTE]
> By default, the grid approximates infinity with a large finite quad
> that recenters under the camera and fades with distance (`GridOptions.fade`).
> Set `infiniteGrid: true` for a truly boundless plane. This mode draws a
> full-viewport quad, unprojects each pixel into a camera ray, and intersects
> that ray with the grid plane so no edge is visible. See
> [Infinite Grid Shader](https://willofindie.com/proj/infinite-grid-shader)
> for the underlying technique.

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
   * Grid style.
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
   * Line width, in pixels.
   * @default 1
   */
  thickness?: number;
}

export interface GridSectionOptions {
  /**
   * Grid style.
   * @default "lines"
   */
  style?: GridStyle;
  /**
   * Cells per section.
   * @default 10
   */
  size?: number;
  /**
   * Section color.
   * @default "#787878"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Line width, in pixels.
   * @default 2
   */
  thickness?: number;
}

export interface GridFadeOptions {
  /**
   * Fade anchor.
   * @default "camera"
   */
  from?: GridFadeFrom;
  /**
   * World-space object to fade (and, by default, recenter) around.
   * Required when `from` is `"target"`; read via `getWorldPosition()` every frame.
   */
  target?: THREE.Object3D;
  /**
   * Fade distance.
   * @default 100
   */
  distance?: number;
  /**
   * Fade strength.
   * @default 1
   */
  strength?: number;
}

export interface GridAxesOptions {
  /**
   * Show axes.
   * @default true
   */
  show?: boolean;
  /**
   * Line width, in pixels.
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

/**
 * Every `@default` here (and on `GridCellOptions`, `GridSectionOptions`,
 * `GridFadeOptions`, `GridAxesOptions`) is `Grid.Defaults`' out-of-the-box
 * value — mutate `Grid.Defaults` to change it process-wide.
 */
export interface GridOptions {
  /**
   * Grid plane.
   * @default "xz"
   */
  plane?: GridPlane;
  /**
   * Quad edge length.
   * @default Math.max(fadeDistance * 4, 200)
   */
  extent?: number;
  /**
   * Fine grid settings.
   */
  cell?: GridCellOptions;
  /**
   * Section grid settings.
   */
  section?: GridSectionOptions;
  /**
   * Cross half-length as a fraction of a cell.
   * @default 0.2
   */
  crossSize?: number;
  /**
   * Fade out cells across section lines.
   * @default false
   */
  hideCellOnSection?: boolean;
  /**
   * Fade width in cells.
   * @default 0.5
   */
  hideCellOnSectionFadeWidth?: number;
  /**
   * Fade settings.
   */
  fade?: GridFadeOptions;
  /**
   * Axis settings.
   */
  axes?: GridAxesOptions;
  /**
   * Offset along the plane normal.
   * @default 0
   */
  offset?: number;
  /**
   * Visible state.
   * @default true
   */
  enabled?: boolean;
  /**
   * Recenter under the camera (or `fade.target`, when `fade.from` is `"target"`) each frame.
   * @default fade.from !== "origin"
   */
  followCamera?: boolean;
  /**
   * Render a boundless plane.
   * @default false
   */
  infiniteGrid?: boolean;
}
```

## Grid.Defaults

Global fallbacks consumed by `new Grid()` whenever the matching `GridOptions` field is omitted.

Already-constructed instances are unaffected.

```ts
class Grid extends THREE.Mesh {
  static readonly Defaults: {
    plane: GridPlaneValue;
    cell: {
      style: GridStyleValue;
      size: number;
      color: THREE.ColorRepresentation;
      thickness: number;
    };
    section: {
      style: GridStyleValue;
      size: number;
      color: THREE.ColorRepresentation;
      thickness: number;
    };
    crossSize: number;
    hideCellOnSection: boolean;
    hideCellOnSectionFadeWidth: number;
    fade: {
      from: GridFadeFrom;
      distance: number;
      strength: number;
    };
    axes: {
      show: boolean;
      thickness: number;
      xColor: THREE.ColorRepresentation;
      yColor: THREE.ColorRepresentation;
      zColor: THREE.ColorRepresentation;
    };
    offset: number;
    enabled: boolean;
    infiniteGrid: boolean;
    extent: {
      minimum: number;
      fadeMultiplier: number;
    };
  };
}
```

```ts
Grid.Defaults.cell.color = "#2a2a2a";
Grid.Defaults.plane = new GridPlaneValue("xy");

const grid = new Grid(); // picks up both defaults
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
  readonly fade: GridFadeValue;

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
  followCamera: boolean;
  readonly infiniteGrid: boolean;
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

class GridFadeValue {
  readonly from: GridFadeFrom;
  // required when `from` is "target" (throws otherwise); reassignable afterward
  target: THREE.Object3D | null;
}

class GridColor {
  // normalized hex, e.g. "#393939";
  // settable with any THREE.ColorRepresentation
  value: string;
}
```

## Usage notes

- `plane`, `cellStyle`, `sectionStyle`, `fade.from`, and `infiniteGrid` are constructor-only. Change them by creating a new `Grid`.
- `fade: { from: "origin" }` with `followCamera: false` gives a bounded reference grid pinned at world origin (opposite the default camera-following mode). This combination has no effect with `infiniteGrid: true`, which ignores `followCamera`.
- `fade: { from: "target", target }` fades around `target`'s live world position instead of the camera. Unless `followCamera: false`, recentering also uses `target`:

```ts
const grid = new Grid({
  fade: {
    from: "target",
    target: player
  }
});
```

  `target` is required when `from` is `"target"` (the constructor throws otherwise). It is read via `target.getWorldPosition()` each frame, so parented objects work correctly. You can reassign `grid.fade.target` later (or set it to `null`) to retarget or fall back to the camera. `grid.fade.from` remains fixed.
- Colors are edited through `.value` on each color property:

```ts
grid.cellColor.value = "#ff0000";
grid.xAxisColor.value = "#e54b4b";
```

- Most numeric/boolean properties (`cellSize`, `fadeDistance`, `showAxes`, `offset`, etc.) are live and apply immediately.

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
| `fade.from` | No | Set once in `new Grid({ fade })`. Baked into the shader. |
| `fade.target` | Yes | Required at construction when `fade.from` is `"target"`; reassignable (or nullable) afterward. Ignored for other `fade.from` values. |
| `followCamera` | Yes | Defaults to `fade.from !== "origin"`. `true` recenters under the camera (or `fade.target` when `fade.from` is `"target"`). `false` pins the mesh to world origin on its plane. Ignored when `infiniteGrid` is true. |
| `infiniteGrid` | No | Set once in `new Grid({ infiniteGrid })`. `true` renders a boundless ground plane (full-viewport ray-plane intersection) instead of the default finite camera-following quad. `extent` and `followCamera` are ignored when true. |

Everything else in the class block (`cellSize`, `sectionSize`, thickness, fade, axes visibility, `offset`) is mutable and applies immediately.
