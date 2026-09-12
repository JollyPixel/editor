// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { BrushCursor } from "../model/brushCursor.ts";
import {
  boundsOf,
  cellsOf,
  type BrushShape
} from "../model/brushFootprint.ts";
import {
  voxelShell,
  type VoxelShell
} from "../model/voxelShell.ts";
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleFrom,
  type BrushStyle
} from "../model/BrushStyle.ts";

// CONSTANTS
const kInflate = 0.01;
const kDefaultHighlight = 0x9df6ff;
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};
const kShells = new Map<string, VoxelShell>();

export interface BrushMeshOptions {
  /**
   * @default 0x33e0ff
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default `color` when it is given, 0x9df6ff otherwise
   */
  borderColor?: THREE.ColorRepresentation;
  /**
   * @default DEFAULT_BRUSH_STYLE
   */
  style?: BrushStyle;
}

/**
 * Reuses one fill and outline while the brush footprint changes.
 */
export class BrushMesh extends THREE.Group {
  #fill: THREE.Mesh;
  #fillMaterial: THREE.MeshBasicMaterial;

  #border: LineSegments2;
  #borderMaterial: Line2NodeMaterial;

  #style: BrushStyle;
  #hidden = false;
  #drawn = false;
  #shapeKey = "";

  constructor(
    options: BrushMeshOptions = {}
  ) {
    super();

    const { color = 0x33e0ff, style = DEFAULT_BRUSH_STYLE } = options;
    const highlight = options.color ?? kDefaultHighlight;
    const borderColor = options.borderColor ?? highlight;

    this.name = "brush";
    this.#style = style;

    this.#fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: style.opacity,
      depthWrite: false
    });
    this.#fill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      this.#fillMaterial
    );
    this.#fill.renderOrder = 1;
    this.#fill.frustumCulled = false;
    this.#fill.visible = false;

    this.#borderMaterial = new Line2NodeMaterial({
      color: borderColor,
      linewidth: style.edgeWidth,
      depthTest: false
    });
    this.#border = new LineSegments2(
      new LineSegmentsGeometry(),
      this.#borderMaterial
    );
    this.#border.renderOrder = 2;
    this.#border.frustumCulled = false;
    this.#border.visible = false;

    this.add(
      this.#fill,
      this.#border
    );
    this.#applyStyle();
  }

  get style(): BrushStyle {
    return this.#style;
  }

  set style(value: BrushStyle) {
    this.#style = brushStyleFrom(value);
    this.#applyStyle();
  }

  hide(): void {
    this.#hidden = true;
    this.#applyVisibility();
  }

  show(): void {
    this.#hidden = false;
    this.#applyVisibility();
  }

  clearFootprint(): void {
    this.#drawn = false;
    this.#applyVisibility();
  }

  draw(
    cursor: BrushCursor
  ): void {
    const { min, span } = boundsOf(cursor);

    this.position.set(
      min.x + (span.x / 2),
      min.y + (span.y / 2),
      min.z + (span.z / 2)
    );
    this.#reshape(cursor);

    this.#drawn = true;
    this.#applyVisibility();
  }

  #reshape(
    shape: BrushShape
  ): void {
    const key = shapeKeyOf(shape);
    if (key === this.#shapeKey) {
      return;
    }
    this.#shapeKey = key;

    const shell = shellOf(key, shape);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(shell.triangles, 3)
    );
    this.#fill.geometry.dispose();
    this.#fill.geometry = geometry;

    // Rebuild to keep dash lengths constant in world units.
    this.#border.geometry.setPositions(shell.edges);
    this.#border.computeLineDistances();
  }

  #applyStyle(): void {
    const {
      opacity,
      edgeWidth,
      edgeStyle,
      dashSize,
      gapSize
    } = this.#style;

    this.#fillMaterial.opacity = opacity;

    this.#borderMaterial.linewidth = edgeWidth;
    this.#borderMaterial.dashed = edgeStyle === "dashed";
    this.#borderMaterial.dashSize = dashSize;
    this.#borderMaterial.gapSize = gapSize;
    this.#borderMaterial.needsUpdate = true;

    this.#applyVisibility();
  }

  #applyVisibility(): void {
    const visible = !this.#hidden && this.#drawn;

    this.#fill.visible = visible && this.#style.opacity > 0;
    this.#border.visible = visible && this.#style.edgeWidth > 0;
  }
}

function shapeKeyOf(
  shape: BrushShape
): string {
  return `${shape.size}:${shape.axis}:${shape.pattern}`;
}

function shellOf(
  key: string,
  shape: BrushShape
): VoxelShell {
  const cached = kShells.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const footprint = {
    ...shape,
    position: kOrigin
  };
  const { min, span } = boundsOf(footprint);
  const shell = voxelShell(cellsOf(footprint));
  const center = [
    min.x + (span.x / 2),
    min.y + (span.y / 2),
    min.z + (span.z / 2)
  ];
  const scale = [
    (span.x + (kInflate * 2)) / span.x,
    (span.y + (kInflate * 2)) / span.y,
    (span.z + (kInflate * 2)) / span.z
  ];
  function toLocal(
    values: number[]
  ): number[] {
    return values.map(
      (value, index) => (value - center[index % 3]) * scale[index % 3]
    );
  }
  const local = {
    triangles: toLocal(shell.triangles),
    edges: toLocal(shell.edges)
  };
  kShells.set(key, local);

  return local;
}
