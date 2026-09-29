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
  isBall,
  type BrushShape
} from "../model/brushFootprint.ts";
import {
  edgesFacing,
  facingKey,
  voxelShell,
  type VoxelShell
} from "../model/voxelShell.ts";
import {
  contourEdges,
  voxelSolid,
  type VoxelSolid
} from "../model/voxelContour.ts";
import { faceCornersOf } from "../model/cellFace.ts";

// CONSTANTS
const kInflate = 0.01;
const kFaceMargin = kInflate + 0.005;
const kOpacity = 0.15;
const kFaceOpacityBoost = 0.35;
const kDefaultColor = 0x33e0ff;
const kSubduedOpacity = 0.5;
const kRimOpacityBoost = 1.8;
const kCenterAlpha = 0.5;
const kEdgeWidth = 2;
const kSubduedEdgeWidth = 1;
const kHaloColor = 0x0b0f14;
const kHaloSpread = 1;
const kDepthBias = 1;
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};
const kShells = new Map<string, BrushShell>();
const kTowardCamera = {
  polygonOffset: true,
  polygonOffsetFactor: -kDepthBias,
  polygonOffsetUnits: -kDepthBias
};

interface BrushShell {
  local: VoxelShell;
  source: VoxelShell;
  solid: VoxelSolid | null;
  center: number[];
  scale: number[];
}

export interface BrushMeshOptions {
  color?: THREE.ColorRepresentation;
  subdued?: boolean;
}

export class BrushMesh extends THREE.Group {
  #fill: THREE.Mesh;
  #fillMaterial: THREE.MeshBasicMaterial;

  #edges = new LineSegmentsGeometry();
  #halo: LineSegments2;
  #border: LineSegments2;

  #face: THREE.Mesh;
  #faceMaterial: THREE.MeshBasicMaterial;

  #subdued: boolean;
  #hidden = false;
  #drawn = false;
  #faced = false;
  #shelled = true;
  #shapeKey = "";
  #shell: BrushShell | null = null;
  #facingKey = "";
  #eye = new THREE.Vector3();

  constructor(
    options: BrushMeshOptions = {}
  ) {
    super();

    const {
      color = kDefaultColor,
      subdued = false
    } = options;
    const weight = subdued ? kSubduedOpacity : 1;
    const edgeWidth = subdued ? kSubduedEdgeWidth : kEdgeWidth;

    this.name = "brush";
    this.#subdued = subdued;

    this.#fillMaterial = new THREE.MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: true,
      opacity: Math.min(1, kOpacity * kRimOpacityBoost) * weight,
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
      linewidth: edgeWidth + kHaloSpread,
      ...kTowardCamera
    }, 2);
    this.#halo.onBeforeRender = (_renderer, _scene, camera) => {
      this.#cullAwayFrom(camera);
    };
    this.#border = this.#edgeLines({
      color,
      linewidth: edgeWidth,
      ...kTowardCamera
    }, 3);

    this.#faceMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(1, kOpacity + kFaceOpacityBoost) * weight,
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
  }

  get shelled(): boolean {
    return this.#shelled;
  }

  set shelled(value: boolean) {
    if (this.#shelled === value) {
      return;
    }

    this.#shelled = value;
    this.#applyVisibility();
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

    const brushShell = shellOf(key, shape);
    const shell = brushShell.local;
    const flat = brushShell.solid !== null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(shell.triangles, 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        shell.rims.flatMap(
          (rim) => [1, 1, 1, rim === 1 && !flat ? 1 : kCenterAlpha]
        ),
        4
      )
    );
    this.#fill.geometry.dispose();
    this.#fill.geometry = geometry;

    this.#shell = brushShell;
    this.#facingKey = "";
    this.#outline(shell.edges);
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
    const key = shell.solid === null ?
      facingKey(shell.local, eye) :
      eye.map((value) => value.toFixed(2)).join(":");
    if (key === this.#facingKey) {
      return;
    }

    this.#facingKey = key;
    if (shell.solid === null) {
      this.#outline(edgesFacing(shell.local, eye));

      return;
    }

    this.#outline(contourOf(shell, shell.solid, eye));
  }

  #outline(
    edges: number[]
  ): void {
    this.#edges.setPositions(edges);
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

  #applyVisibility(): void {
    const visible = !this.#hidden && this.#drawn;
    const shelled = visible && this.#shelled;

    this.#fill.visible = shelled;
    this.#face.visible = visible && this.#faced;
    this.#halo.visible = shelled && !this.#subdued;
    this.#border.visible = shelled;
  }
}

function shapeKeyOf(
  shape: BrushShape
): string {
  return `${shape.size}:${shape.axis}:${shape.pattern}`;
}

function contourOf(
  shell: BrushShell,
  solid: VoxelSolid,
  eye: number[]
): number[] {
  const { center, scale } = shell;
  const sourceEye = eye.map(
    (value, index) => (value / scale[index]) + center[index]
  );

  return contourEdges(shell.source, solid, sourceEye).map(
    (value, index) => (value - center[index % 3]) * scale[index % 3]
  );
}

function shellOf(
  key: string,
  shape: BrushShape
): BrushShell {
  const cached = kShells.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const footprint = {
    ...shape,
    position: kOrigin
  };
  const { min, span } = boundsOf(footprint);
  const cells = cellsOf(footprint);
  const shell = voxelShell(cells);
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
  const brushShell: BrushShell = {
    local,
    source: shell,
    solid: isBall(shape) ? voxelSolid(cells) : null,
    center,
    scale
  };
  kShells.set(key, brushShell);

  return brushShell;
}
