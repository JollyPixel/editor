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
  edgesFacing,
  facingKey,
  voxelShell,
  type VoxelShell
} from "../model/voxelShell.ts";
import { faceCornersOf } from "../model/cellFace.ts";
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleFrom,
  type BrushStyle
} from "../model/BrushStyle.ts";

// CONSTANTS
const kInflate = 0.01;
const kFaceMargin = kInflate + 0.005;
const kFaceOpacityBoost = 0.35;
const kDefaultColor = 0x33e0ff;
const kSubduedOpacity = 0.5;
const kRimOpacityBoost = 1.8;
const kCenterAlpha = 0.5;
const kMarchSpeed = 0.35;
const kSubduedEdgeTrim = 1;
const kHaloColor = 0x0b0f14;
const kHaloSpread = 1;
const kDepthBias = 1;
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};
const kShells = new Map<string, VoxelShell>();
const kTowardCamera = {
  polygonOffset: true,
  polygonOffsetFactor: -kDepthBias,
  polygonOffsetUnits: -kDepthBias
};

export interface BrushMeshOptions {
  /**
   * @default 0x33e0ff
   */
  color?: THREE.ColorRepresentation;
  /**
   * Draws a fainter fill and a thinner outline without its dark backing.
   * @default false
   */
  subdued?: boolean;
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

  #edges = new LineSegmentsGeometry();
  #halo: LineSegments2;
  #border: LineSegments2;

  #face: THREE.Mesh;
  #faceMaterial: THREE.MeshBasicMaterial;

  #style: BrushStyle;
  #subdued: boolean;
  #hidden = false;
  #drawn = false;
  #faced = false;
  #shapeKey = "";
  #shell: VoxelShell | null = null;
  #facingKey = "";
  #eye = new THREE.Vector3();

  constructor(
    options: BrushMeshOptions = {}
  ) {
    super();

    const {
      color = kDefaultColor,
      style = DEFAULT_BRUSH_STYLE,
      subdued = false
    } = options;

    this.name = "brush";
    this.#style = style;
    this.#subdued = subdued;

    this.#fillMaterial = new THREE.MeshBasicMaterial({
      color,
      vertexColors: true,
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

    this.#halo = this.#edgeLines({
      color: kHaloColor,
      ...kTowardCamera
    }, 2);
    this.#halo.onBeforeRender = (_renderer, _scene, camera) => {
      this.#cullAwayFrom(camera);
      this.#march();
    };
    this.#border = this.#edgeLines({
      color,
      ...kTowardCamera
    }, 3);

    this.#faceMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(12), 3)
    );
    faceGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.#face = new THREE.Mesh(
      faceGeometry,
      this.#faceMaterial
    );
    this.#face.renderOrder = 1;
    this.#face.frustumCulled = false;
    this.#face.visible = false;

    this.add(
      this.#fill,
      this.#face,
      this.#halo,
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
    this.#placeFace(cursor);

    this.#drawn = true;
    this.#applyVisibility();
  }

  #placeFace(
    cursor: BrushCursor
  ): void {
    const { face } = cursor;
    this.#faced = face !== undefined;
    if (face === undefined) {
      return;
    }

    const corners = faceCornersOf(
      cursor.position,
      face,
      kFaceMargin
    );
    const attribute = this.#face.geometry.getAttribute("position");
    corners.forEach((corner, index) => {
      attribute.setXYZ(
        index,
        corner.x - this.position.x,
        corner.y - this.position.y,
        corner.z - this.position.z
      );
    });
    attribute.needsUpdate = true;
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
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        shell.rims.flatMap(
          (rim) => [1, 1, 1, rim === 1 ? 1 : kCenterAlpha]
        ),
        4
      )
    );
    this.#fill.geometry.dispose();
    this.#fill.geometry = geometry;

    this.#shell = shell;
    this.#facingKey = "";
    this.#outline(shell.edges);
  }

  #march(): void {
    const { edgeStyle, dashSize, gapSize } = this.#style;
    if (this.#subdued || edgeStyle !== "dashed") {
      return;
    }

    const period = dashSize + gapSize;
    const offset = -((Date.now() / 1000) * kMarchSpeed) % period;
    this.#halo.material.dashOffset = offset;
    this.#border.material.dashOffset = offset;
  }

  #cullAwayFrom(
    camera: THREE.Camera
  ): void {
    const shell = this.#shell;
    if (shell === null) {
      return;
    }

    const eye = this.worldToLocal(
      this.#eye.setFromMatrixPosition(camera.matrixWorld)
    ).toArray();
    const key = facingKey(shell, eye);
    if (key === this.#facingKey) {
      return;
    }

    this.#facingKey = key;
    this.#outline(edgesFacing(shell, eye));
  }

  #outline(
    edges: number[]
  ): void {
    // Rebuild to keep dash lengths constant in world units.
    this.#edges.setPositions(edges);
    this.#border.computeLineDistances();
  }

  #edgeLines(
    parameters: ConstructorParameters<typeof Line2NodeMaterial>[0],
    renderOrder: number
  ): LineSegments2 {
    const lines = new LineSegments2(
      this.#edges,
      new Line2NodeMaterial({
        depthWrite: false,
        ...parameters
      })
    );
    lines.renderOrder = renderOrder;
    lines.frustumCulled = false;
    lines.visible = false;

    return lines;
  }

  #applyStyle(): void {
    const {
      opacity,
      edgeWidth,
      edgeStyle,
      dashSize,
      gapSize
    } = this.#style;

    const weight = this.#subdued ? kSubduedOpacity : 1;
    const width = this.#subdued ?
      Math.min(edgeWidth, Math.max(1, edgeWidth - kSubduedEdgeTrim)) :
      edgeWidth;

    this.#fillMaterial.opacity =
      Math.min(1, opacity * kRimOpacityBoost) * weight;
    this.#faceMaterial.opacity =
      Math.min(1, opacity + kFaceOpacityBoost) * weight;

    const widths = [
      [this.#halo, width + kHaloSpread],
      [this.#border, width]
    ] as const;
    for (const [lines, linewidth] of widths) {
      const { material } = lines;
      material.linewidth = linewidth;
      material.dashed = edgeStyle === "dashed";
      material.dashSize = dashSize;
      material.gapSize = gapSize;
      material.needsUpdate = true;
    }

    this.#applyVisibility();
  }

  #applyVisibility(): void {
    const visible = !this.#hidden && this.#drawn;

    this.#fill.visible = visible && this.#style.opacity > 0;
    this.#face.visible = visible && this.#faced;
    const edged = visible && this.#style.edgeWidth > 0;
    this.#halo.visible = edged && !this.#subdued;
    this.#border.visible = edged;
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
  const local: VoxelShell = {
    triangles: toLocal(shell.triangles),
    edges: toLocal(shell.edges),
    rims: shell.rims,
    edgeFaces: shell.edgeFaces,
    planes: [
      shell.planes[0].map((plane) => (plane - center[0]) * scale[0]),
      shell.planes[1].map((plane) => (plane - center[1]) * scale[1]),
      shell.planes[2].map((plane) => (plane - center[2]) * scale[2])
    ]
  };
  kShells.set(key, local);

  return local;
}
