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
  type GridFadeFrom,
  type GridUniforms
} from "./shader.ts";
import {
  GridColor
} from "./GridColor.ts";
import {
  GridStyleValue
} from "./GridStyleValue.ts";
import {
  GridFadeValue
} from "./GridFadeValue.ts";
import type {
  Vector3Like
} from "../types.ts";

// CONSTANTS
const kInfiniteGridQuadSize = 2;

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
  "axisThickness",
  "offset"
] as const;

// boolean <-> tri-state float (`.value` is 0 or 1) onto a `GridUniforms` entry.
const kBooleanUniformKeys = [
  "hideCellOnSection",
  "showAxes"
] as const;

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
 * value; mutate `Grid.Defaults` to change it process-wide.
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

export interface GridCellDefaults {
  style: GridStyleValue;
  size: number;
  color: THREE.ColorRepresentation;
  thickness: number;
}

export interface GridSectionDefaults {
  style: GridStyleValue;
  size: number;
  color: THREE.ColorRepresentation;
  thickness: number;
}

export interface GridFadeDefaults {
  from: GridFadeFrom;
  distance: number;
  strength: number;
}

export interface GridAxesDefaults {
  show: boolean;
  thickness: number;
  xColor: THREE.ColorRepresentation;
  yColor: THREE.ColorRepresentation;
  zColor: THREE.ColorRepresentation;
}

export interface GridExtentDefaults {
  /**
   * Floor applied to `fadeDistance * fadeMultiplier`.
   */
  minimum: number;
  /**
   * Multiplier applied to `fade.distance` when `GridOptions.extent` is omitted.
   */
  fadeMultiplier: number;
}

/**
 * Global fallbacks consumed by `new Grid()` whenever the matching `GridOptions` field is omitted.
 */
export interface GridDefaults {
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

/**
 * Live-tunable properties defined in the constructor.
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
  offset: number;
  hideCellOnSection: boolean;
  showAxes: boolean;
}

/**
 * Ground-plane grid mesh.
 *
 * @note
 * Uses TSL and requires `THREE.WebGPURenderer`;
 */
export class Grid extends THREE.Mesh<THREE.PlaneGeometry> {
  static readonly Defaults: GridDefaults = {
    plane: new GridPlaneValue("xz"),
    cell: {
      style: new GridStyleValue("lines", "cellStyle"),
      size: 1,
      color: "#393939",
      thickness: 1
    },
    section: {
      style: new GridStyleValue("lines", "sectionStyle"),
      size: 10,
      color: "#787878",
      thickness: 2
    },
    crossSize: 0.2,
    hideCellOnSection: false,
    hideCellOnSectionFadeWidth: 0.5,
    fade: {
      from: "camera",
      distance: 100,
      strength: 1
    },
    axes: {
      show: true,
      thickness: 2,
      xColor: "#e54b4b",
      yColor: "#4bc94b",
      zColor: "#4b7bc9"
    },
    offset: 0,
    enabled: true,
    infiniteGrid: false,
    extent: {
      minimum: 200,
      fadeMultiplier: 4
    }
  };

  readonly plane: GridPlaneValue;
  readonly cellStyle: GridStyleValue;
  readonly sectionStyle: GridStyleValue;
  readonly cellColor: GridColor;
  readonly sectionColor: GridColor;
  readonly xAxisColor: GridColor;
  readonly yAxisColor: GridColor;
  readonly zAxisColor: GridColor;
  readonly fade: GridFadeValue;
  readonly infiniteGrid: boolean;
  followCamera: boolean;

  readonly #uniforms: GridUniforms;

  constructor(
    options: GridOptions = {}
  ) {
    const cell = options.cell ?? {};
    const section = options.section ?? {};
    const axes = options.axes ?? {};
    const fadeOptions = options.fade ?? {};

    const defaults = Grid.Defaults;

    const plane = options.plane === undefined ?
      defaults.plane.clone() :
      new GridPlaneValue(options.plane);
    const cellStyle = cell.style === undefined ?
      defaults.cell.style.clone() :
      new GridStyleValue(cell.style, "cellStyle");
    const sectionStyle = section.style === undefined ?
      defaults.section.style.clone() :
      new GridStyleValue(section.style, "sectionStyle");

    const infiniteGrid = options.infiniteGrid ?? defaults.infiniteGrid;

    const fadeDistance = fadeOptions.distance ?? defaults.fade.distance;
    const extent = options.extent ?? Math.max(
      fadeDistance * defaults.extent.fadeMultiplier,
      defaults.extent.minimum
    );

    // Infinite mode uses a fixed 2x2 quad; the fragment shader handles orientation.
    const geometry = infiniteGrid ?
      new THREE.PlaneGeometry(kInfiniteGridQuadSize, kInfiniteGridQuadSize) :
      new THREE.PlaneGeometry(extent, extent);
    if (!infiniteGrid) {
      plane.orientGeometry(geometry);
    }

    const uniforms = createGridUniforms({
      cellSize: cell.size ?? defaults.cell.size,
      sectionSize: section.size ?? defaults.section.size,
      cellColor: cell.color ?? defaults.cell.color,
      sectionColor: section.color ?? defaults.section.color,
      cellThickness: cell.thickness ?? defaults.cell.thickness,
      sectionThickness: section.thickness ?? defaults.section.thickness,
      crossSize: options.crossSize ?? defaults.crossSize,
      hideCellOnSection: options.hideCellOnSection ?? defaults.hideCellOnSection,
      hideCellOnSectionFadeWidth: options.hideCellOnSectionFadeWidth ?? defaults.hideCellOnSectionFadeWidth,
      fadeDistance,
      fadeStrength: fadeOptions.strength ?? defaults.fade.strength,
      showAxes: axes.show ?? defaults.axes.show,
      axisThickness: axes.thickness ?? defaults.axes.thickness,
      xAxisColor: axes.xColor ?? defaults.axes.xColor,
      yAxisColor: axes.yColor ?? defaults.axes.yColor,
      zAxisColor: axes.zColor ?? defaults.axes.zColor,
      offset: options.offset ?? defaults.offset
    });
    const fade = new GridFadeValue(
      fadeOptions.from ?? defaults.fade.from,
      fadeOptions.target
    );
    const material = buildGridMaterial({
      plane: plane.value,
      cellStyle: cellStyle.value,
      sectionStyle: sectionStyle.value,
      uniforms,
      fadeFrom: fade.from,
      infiniteGrid
    });

    super(geometry, material);

    this.plane = plane;
    this.cellStyle = cellStyle;
    this.sectionStyle = sectionStyle;
    this.cellColor = new GridColor(uniforms.cellColor.value);
    this.sectionColor = new GridColor(uniforms.sectionColor.value);
    this.xAxisColor = new GridColor(uniforms.xAxisColor.value);
    this.yAxisColor = new GridColor(uniforms.yAxisColor.value);
    this.zAxisColor = new GridColor(uniforms.zAxisColor.value);
    this.fade = fade;
    this.infiniteGrid = infiniteGrid;
    this.followCamera = options.followCamera ?? (fade.from !== "origin");
    this.frustumCulled = false;
    this.visible = options.enabled ?? defaults.enabled;
    this.#uniforms = uniforms;

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

    this.onBeforeRender = this.#onBeforeRender;
  }

  readonly #onBeforeRender = (
    _renderer: unknown,
    _scene: unknown,
    camera: THREE.Camera
  ): void => {
    // Runs even in infinite mode: repositioning is skipped below, but the fragment
    // shader's fade calc reads `uniforms.targetPosition` directly every frame.
    this.fade.trackTarget(
      this.#uniforms.targetPosition.value
    );

    // Infinite mode skips per-frame repositioning; the fragment shader unprojects every pixel.
    if (this.infiniteGrid) {
      return;
    }

    const source = this.followCamera ?
      this.fade.anchorPosition(
        camera.position,
        this.#uniforms.targetPosition.value
      ) :
      createOriginVector3();
    const next = this.plane.followPosition(
      source,
      this.#uniforms.offset.value
    );

    this.position.set(
      next.x,
      next.y,
      next.z
    );
  };

  get enabled(): boolean {
    return this.visible;
  }

  set enabled(
    value: boolean
  ) {
    this.visible = value;
  }

  dispose(): void {
    this.geometry.dispose();

    const materials = Array.isArray(
      this.material
    ) ? this.material : [this.material];
    for (const material of materials) {
      material.dispose();
    }
  }
}

function createOriginVector3(): Vector3Like {
  return {
    x: 0,
    y: 0,
    z: 0
  };
}

export type {
  GridPlane
} from "./GridPlaneValue.ts";
export type {
  GridStyle,
  GridFadeFrom
} from "./shader.ts";

export {
  GridColor,
  GridPlaneValue,
  GridStyleValue,
  GridFadeValue
};
