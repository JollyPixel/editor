// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AXIS_COLOR } from "../../common/axes.ts";
import { screenScaleFactor } from "../../common/screenScaleFactor.ts";
import { BoxVolume } from "../BoxVolume.ts";

// CONSTANTS
const kSegments = 96;
const kFullTurn = Math.PI * 2;
const kAxisRadius = 0.04;
const kAxisOverhang = 0.35;
const kRingWidth = 0.05;
const kSectorOpacity = 0.2;
const kRenderOrder = 19;

const kSize = new THREE.Vector3();
const kPivot = new THREE.Vector3();
const kAnchor = new THREE.Vector3();

export type PivotResolver = (
  box: BoxVolume,
  target: THREE.Vector3
) => THREE.Vector3;

export interface BoxRotateDialOptions {
  camera: THREE.Camera;
  handleSize: number;
  pivot: PivotResolver;
}

export class BoxRotateDial extends THREE.Object3D {
  #camera: THREE.Camera;
  #handleSize: number;
  #pivot: PivotResolver;
  #axis: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  #ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #sector: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #corner = new THREE.Vector3();
  #angle = 0;
  #disposed = false;

  constructor(
    options: BoxRotateDialOptions
  ) {
    super();

    this.name = "box-rotate-dial";
    this.#camera = options.camera;
    this.#handleSize = options.handleSize;
    this.#pivot = options.pivot;

    this.#axis = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0),
      overlayMaterial(1)
    );
    this.#axis.name = "box-rotate-pivot";
    this.#ring = new THREE.Mesh(
      dynamicGeometry(kSegments * 6),
      overlayMaterial(1)
    );
    this.#sector = new THREE.Mesh(
      dynamicGeometry(kSegments * 3),
      overlayMaterial(kSectorOpacity)
    );

    for (const mesh of [this.#axis, this.#ring, this.#sector]) {
      mesh.renderOrder = kRenderOrder;
      mesh.frustumCulled = false;
    }
    this.add(this.#axis, this.#ring, this.#sector);
    this.hide();
  }

  showPivot(): void {
    this.visible = true;
    this.#ring.visible = false;
    this.#sector.visible = false;
  }

  beginSweep(
    corner: THREE.Vector3Like
  ): void {
    this.#corner.copy(corner);
    this.#angle = 0;
    this.visible = true;
    this.#ring.visible = true;
    this.#sector.visible = true;
  }

  sweepTo(
    angle: number
  ): void {
    this.#angle = angle;
  }

  hide(): void {
    this.visible = false;
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const parent = this.parent;
    if (this.visible && parent instanceof BoxVolume) {
      this.#layout(parent);
    }

    super.updateMatrixWorld(force);
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const mesh of [this.#axis, this.#ring, this.#sector]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.clear();
  }

  #layout(
    box: BoxVolume
  ): void {
    box.copySizeTo(kSize);
    this.#pivot(box, kPivot);
    this.position.set(
      kPivot.x - box.position.x,
      0,
      kPivot.z - box.position.z
    );

    kAnchor.copy(this.position).applyMatrix4(box.matrixWorld);
    const scale = screenScaleFactor(this.#camera, kAnchor) * this.#handleSize;
    const overhang = kAxisOverhang * scale;
    this.#axis.position.y = -overhang;
    this.#axis.scale.set(
      kAxisRadius * scale,
      kSize.y + (overhang * 2),
      kAxisRadius * scale
    );

    if (!this.#ring.visible) {
      return;
    }

    const dx = this.#corner.x - kPivot.x;
    const dz = this.#corner.z - kPivot.z;
    const radius = Math.hypot(dx, dz);
    const start = Math.atan2(dz, dx);
    writeRing(
      this.#ring.geometry,
      radius,
      kRingWidth * scale,
      kSize.y
    );
    writeSector(
      this.#sector.geometry,
      radius,
      start,
      this.#angle,
      kSize.y
    );
  }
}

function overlayMaterial(
  opacity: number
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: AXIS_COLOR.y,
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
}

function dynamicGeometry(
  vertexCount: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(
    new Float32Array(vertexCount * 3),
    3
  );
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);

  return geometry;
}

function writeRing(
  geometry: THREE.BufferGeometry,
  radius: number,
  width: number,
  height: number
): void {
  const position = geometry.getAttribute("position");
  const inner = Math.max(radius - width, 0);
  const outer = radius + width;

  for (let segment = 0; segment < kSegments; segment++) {
    const from = (segment / kSegments) * kFullTurn;
    const to = ((segment + 1) / kSegments) * kFullTurn;
    const at = segment * 6;

    setPolar(position, at, inner, from, height);
    setPolar(position, at + 1, outer, to, height);
    setPolar(position, at + 2, outer, from, height);
    setPolar(position, at + 3, inner, from, height);
    setPolar(position, at + 4, inner, to, height);
    setPolar(position, at + 5, outer, to, height);
  }
  position.needsUpdate = true;
}

function writeSector(
  geometry: THREE.BufferGeometry,
  radius: number,
  start: number,
  angle: number,
  height: number
): void {
  const position = geometry.getAttribute("position");
  const sweep = Math.max(Math.min(angle, kFullTurn), -kFullTurn);
  const count = Math.max(
    Math.ceil((Math.abs(sweep) / kFullTurn) * kSegments),
    1
  );

  for (let segment = 0; segment < count; segment++) {
    const at = segment * 3;

    position.setXYZ(at, 0, height, 0);
    setPolar(position, at + 1, radius, start - (sweep * segment / count), height);
    setPolar(
      position,
      at + 2,
      radius,
      start - (sweep * (segment + 1) / count),
      height
    );
  }
  geometry.setDrawRange(0, count * 3);
  position.needsUpdate = true;
}

function setPolar(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
  radius: number,
  angle: number,
  height: number
): void {
  position.setXYZ(
    index,
    radius * Math.cos(angle),
    height,
    radius * Math.sin(angle)
  );
}
