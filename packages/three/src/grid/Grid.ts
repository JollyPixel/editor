// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  type GridPlane,
  GridPlaneValue
} from "./GridPlaneValue.ts";
import {
  createGridUniforms,
  buildGridMaterial,
  type GridStyle,
  type GridFadeFrom
} from "./shader.ts";
import { GridColor } from "./GridColor.ts";
import { GridStyleValue } from "./GridStyleValue.ts";

export type { GridPlane } from "./GridPlaneValue.ts";
export type { GridStyle, GridFadeFrom } from "./shader.ts";

// CONSTANTS
const kDefaultCellSize = 1;
const kDefaultSectionSize = 10;
const kDefaultCellColor = "#393939";
const kDefaultSectionColor = "#787878";
const kDefaultCellThickness = 1;
const kDefaultSectionThickness = 2;
const kDefaultCellStyle: GridStyle = "lines";
const kDefaultSectionStyle: GridStyle = "lines";
const kDefaultCrossSize = 0.2;
const kDefaultHideCellOnSection = false;
const kDefaultHideCellOnSectionFadeWidth = 0.5;
const kDefaultFadeDistance = 100;
const kDefaultFadeStrength = 1;
const kDefaultShowAxes = true;
const kDefaultAxisThickness = 2;
const kDefaultXAxisColor = "#e54b4b";
const kDefaultYAxisColor = "#4bc94b";
const kDefaultZAxisColor = "#4b7bc9";
const kDefaultOffset = 0;
const kDefaultEnabled = true;
const kDefaultFadeFrom: GridFadeFrom = "camera";
const kMinExtent = 200;
const kExtentFadeMultiplier = 4;

// Plain number passthrough onto a `GridUniforms` entry's `.value`.
const kNumberUniformKeys = [
  "cellSize",
  "sectionSize",
  "cellThickness",
  "sectionThickness",
  "crossSize",
  "hideCellOnSectionFadeWidth",
  "fadeDistance",
  "fadeStrength",
  "axisThickness"
] as const;

// boolean <-> tri-state float (`.value` is 0 or 1) onto a `GridUniforms` entry.
const kBooleanUniformKeys = [
  "hideCellOnSection",
  "showAxes"
] as const;

/**
 * Fine cell grid options.
 */
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

/**
 * Coarse section grid options.
 */
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

/**
 * Distance-fade options.
 */
export interface GridFadeOptions {
  /**
   * Distance-fade anchor: `"camera"` fades the grid out around the camera's
   * in-plane position; `"origin"` fades it out around the plane's world
   * origin, ignoring the camera entirely.
   * @default "camera"
   */
  from?: GridFadeFrom;
  /**
   * Fade-out distance.
   * @default 100
   */
  distance?: number;
  /**
   * Fade falloff exponent.
   * @default 1
   */
  strength?: number;
}

/**
 * Axis-line options.
 */
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

/**
 * Constructor options for `Grid`.
 */
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
   * Distance-fade options.
   */
  fade?: GridFadeOptions;
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
  /**
   * Whether the grid mesh re-centers under the camera every frame to
   * maintain the infinite-plane illusion.
   * @default fade.from === "camera"
   */
  followCamera?: boolean;
}

/**
 * Live-tunable numeric and boolean properties defined via `Object.defineProperty`
 * in the constructor (see `kNumberUniformKeys`/`kBooleanUniformKeys`), each a thin
 * passthrough onto the matching `GridUniforms` entry.
 */
export interface Grid {
  cellSize: number;
  sectionSize: number;
  cellThickness: number;
  sectionThickness: number;
  crossSize: number;
  hideCellOnSectionFadeWidth: number;
  fadeDistance: number;
  fadeStrength: number;
  axisThickness: number;
  hideCellOnSection: boolean;
  showAxes: boolean;
}

/**
 * Infinite, camera-following ground-plane grid mesh.
 *
 * @note
 * Uses TSL and requires `THREE.WebGPURenderer`;
 */
export class Grid extends THREE.Mesh {
  readonly plane: GridPlaneValue;
  readonly cellStyle: GridStyleValue;
  readonly sectionStyle: GridStyleValue;
  readonly cellColor: GridColor;
  readonly sectionColor: GridColor;
  readonly xAxisColor: GridColor;
  readonly yAxisColor: GridColor;
  readonly zAxisColor: GridColor;
  readonly fadeFrom: GridFadeFrom;
  offset: number;
  followCamera: boolean;

  constructor(
    options: GridOptions = {}
  ) {
    const cell = options.cell ?? {};
    const section = options.section ?? {};
    const axes = options.axes ?? {};
    const fadeOptions = options.fade ?? {};

    const plane = new GridPlaneValue(
      options.plane ?? "xz"
    );
    const cellStyle = new GridStyleValue(
      cell.style ?? kDefaultCellStyle, "cellStyle"
    );
    const sectionStyle = new GridStyleValue(
      section.style ?? kDefaultSectionStyle, "sectionStyle"
    );

    const fadeDistance = fadeOptions.distance ?? kDefaultFadeDistance;
    const extent = options.extent ?? Math.max(
      fadeDistance * kExtentFadeMultiplier,
      kMinExtent
    );

    const geometry = new THREE.PlaneGeometry(extent, extent);
    plane.orientGeometry(geometry);

    const uniforms = createGridUniforms({
      cellSize: cell.size ?? kDefaultCellSize,
      sectionSize: section.size ?? kDefaultSectionSize,
      cellColor: cell.color ?? kDefaultCellColor,
      sectionColor: section.color ?? kDefaultSectionColor,
      cellThickness: cell.thickness ?? kDefaultCellThickness,
      sectionThickness: section.thickness ?? kDefaultSectionThickness,
      crossSize: options.crossSize ?? kDefaultCrossSize,
      hideCellOnSection: options.hideCellOnSection ?? kDefaultHideCellOnSection,
      hideCellOnSectionFadeWidth: options.hideCellOnSectionFadeWidth ?? kDefaultHideCellOnSectionFadeWidth,
      fadeDistance,
      fadeStrength: fadeOptions.strength ?? kDefaultFadeStrength,
      showAxes: axes.show ?? kDefaultShowAxes,
      axisThickness: axes.thickness ?? kDefaultAxisThickness,
      xAxisColor: axes.xColor ?? kDefaultXAxisColor,
      yAxisColor: axes.yColor ?? kDefaultYAxisColor,
      zAxisColor: axes.zColor ?? kDefaultZAxisColor
    });
    const fadeFrom = fadeOptions.from ?? kDefaultFadeFrom;
    const material = buildGridMaterial(
      plane.value,
      cellStyle.value,
      sectionStyle.value,
      uniforms,
      fadeFrom
    );

    super(geometry, material);

    this.plane = plane;
    this.cellStyle = cellStyle;
    this.sectionStyle = sectionStyle;
    this.cellColor = new GridColor(uniforms.cellColor.value);
    this.sectionColor = new GridColor(uniforms.sectionColor.value);
    this.xAxisColor = new GridColor(uniforms.xAxisColor.value);
    this.yAxisColor = new GridColor(uniforms.yAxisColor.value);
    this.zAxisColor = new GridColor(uniforms.zAxisColor.value);
    this.fadeFrom = fadeFrom;
    this.offset = options.offset ?? kDefaultOffset;
    this.followCamera = options.followCamera ?? (fadeFrom === "camera");
    this.frustumCulled = false;
    this.visible = options.enabled ?? kDefaultEnabled;

    for (const key of kNumberUniformKeys) {
      Object.defineProperty(this, key, {
        get: () => uniforms[key].value,
        set: (value: number) => {
          uniforms[key].value = value;
        },
        enumerable: true
      });
    }

    for (const key of kBooleanUniformKeys) {
      Object.defineProperty(this, key, {
        get: () => uniforms[key].value !== 0,
        set: (value: boolean) => {
          uniforms[key].value = value ? 1 : 0;
        },
        enumerable: true
      });
    }

    this.onBeforeRender = (
      _renderer: unknown,
      _scene: unknown,
      camera: THREE.Camera
    ): void => {
      const source = this.followCamera ?
        camera.position :
        { x: 0, y: 0, z: 0 };
      const next = this.plane.followPosition(
        source,
        this.offset
      );

      this.position.set(
        next.x,
        next.y,
        next.z
      );
    };
  }

  get enabled(): boolean {
    return this.visible;
  }

  set enabled(
    value: boolean
  ) {
    this.visible = value;
  }
}

export {
  GridColor,
  GridPlaneValue,
  GridStyleValue
};
