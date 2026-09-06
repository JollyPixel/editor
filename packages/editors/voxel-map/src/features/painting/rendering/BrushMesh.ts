// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  boundsOf,
  type BrushCursor
} from "../model/brushCursor.ts";
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleFrom,
  type BrushStyle
} from "../model/BrushStyle.ts";

// CONSTANTS
// The extra 0.01 per side prevents z-fighting with the chunk mesh.
const kInflate = 0.01;
const kDefaultHighlight = 0x9df6ff;

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
  #span = {
    x: 0,
    y: 0,
    z: 0
  };

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
      new THREE.BoxGeometry(1, 1, 1),
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
    this.#resize(span);

    this.#drawn = true;
    this.#applyVisibility();
  }

  #resize(
    span: VoxelCoord
  ): void {
    if (
      span.x === this.#span.x &&
      span.y === this.#span.y &&
      span.z === this.#span.z
    ) {
      return;
    }
    this.#span = {
      x: span.x,
      y: span.y,
      z: span.z
    };

    const width = span.x + (kInflate * 2);
    const height = span.y + (kInflate * 2);
    const depth = span.z + (kInflate * 2);

    this.#fill.scale.set(width, height, depth);
    // Rebuild to keep dash lengths constant in world units.
    this.#border.geometry.setPositions(
      boxEdgePositions(width / 2, height / 2, depth / 2)
    );
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

function boxEdgePositions(
  hx: number,
  hy: number,
  hz: number
): number[] {
  const corners: number[][] = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, -hy, hz],
    [-hx, -hy, hz],
    [-hx, hy, -hz],
    [hx, hy, -hz],
    [hx, hy, hz],
    [-hx, hy, hz]
  ];
  const edges: number[][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const result: number[] = [];

  for (const [from, to] of edges) {
    result.push(...corners[from], ...corners[to]);
  }

  return result;
}
