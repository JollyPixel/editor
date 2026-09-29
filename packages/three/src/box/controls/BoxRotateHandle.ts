// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type AxisSign,
  AXIS_COLOR,
  AXIS_DIRECTION,
  HANDLE_HIGHLIGHT_COLOR
} from "../../common/axes.ts";
import { eyeDirection } from "../../common/eyeDirection.ts";
import { screenScaleFactor } from "../../common/screenScaleFactor.ts";
import { BoxVolume } from "../BoxVolume.ts";
import {
  createRotateArcGeometry,
  createRotateArcPickerGeometry
} from "./rotateArcGeometry.ts";

// CONSTANTS
const kRenderOrder = 20;
const kDirections: readonly AxisSign[] = [1, -1];

const kSize = new THREE.Vector3();
const kCenter = new THREE.Vector3();
const kEye = new THREE.Vector3();
const kAnchor = new THREE.Vector3();
const kInverse = new THREE.Matrix4();

interface ArcHalf {
  direction: AxisSign;
  arc: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  picker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export interface BoxRotateHandleOptions {
  camera: THREE.Camera;
  handleSize: number;
}

export class BoxRotateHandle extends THREE.Object3D {
  #camera: THREE.Camera;
  #handleSize: number;
  #halves: ArcHalf[] = [];
  #hovered: AxisSign | null = null;
  #disposed = false;

  constructor(
    options: BoxRotateHandleOptions
  ) {
    super();

    this.name = "box-handle-rotate";
    this.#camera = options.camera;
    this.#handleSize = options.handleSize;

    for (const direction of kDirections) {
      const label = direction === 1 ? "positive" : "negative";
      const arc = new THREE.Mesh(
        createRotateArcGeometry(direction),
        new THREE.MeshBasicMaterial({
          color: AXIS_COLOR.y,
          depthTest: false,
          transparent: true
        })
      );
      arc.name = `box-handle-rotate-${label}`;
      arc.renderOrder = kRenderOrder;
      arc.frustumCulled = false;

      const picker = new THREE.Mesh(
        createRotateArcPickerGeometry(direction),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      picker.name = `box-handle-rotate-${label}-picker`;
      picker.visible = false;

      this.#halves.push({
        direction,
        arc,
        picker
      });
      this.add(arc, picker);
    }
  }

  get pickers(): THREE.Object3D[] {
    return this.#halves.map((half) => half.picker);
  }

  resolve(
    intersection: THREE.Intersection
  ): AxisSign | null {
    const half = this.#halves.find(
      (candidate) => candidate.picker === intersection.object
    );

    return half?.direction ?? null;
  }

  hover(
    direction: AxisSign | null
  ): void {
    if (direction === this.#hovered) {
      return;
    }

    this.#hovered = direction;
    for (const half of this.#halves) {
      half.arc.material.color.set(
        half.direction === direction ? HANDLE_HIGHLIGHT_COLOR : AXIS_COLOR.y
      );
    }
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const parent = this.parent;
    if (parent instanceof BoxVolume) {
      parent.copySizeTo(kSize);
      kCenter
        .copy(kSize)
        .multiplyScalar(0.5)
        .applyMatrix4(parent.matrixWorld);
      eyeDirection(this.#camera, kCenter, kEye).transformDirection(
        kInverse.copy(parent.matrixWorld).invert()
      );

      const signX: AxisSign = kEye.x >= 0 ? 1 : -1;
      const signZ: AxisSign = kEye.z >= 0 ? 1 : -1;
      this.position.set(
        signX === 1 ? kSize.x : 0,
        kSize.y,
        signZ === 1 ? kSize.z : 0
      );
      this.quaternion.setFromAxisAngle(
        AXIS_DIRECTION.y,
        cornerAngle(signX, signZ)
      );

      kAnchor.copy(this.position).applyMatrix4(parent.matrixWorld);
      this.scale.setScalar(
        screenScaleFactor(this.#camera, kAnchor) * this.#handleSize
      );
    }

    super.updateMatrixWorld(force);
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const { arc, picker } of this.#halves) {
      arc.geometry.dispose();
      arc.material.dispose();
      picker.geometry.dispose();
      picker.material.dispose();
    }
    this.#halves = [];
    this.clear();
  }
}

function cornerAngle(
  signX: AxisSign,
  signZ: AxisSign
): number {
  if (signX === 1) {
    return signZ === 1 ? 0 : Math.PI / 2;
  }

  return signZ === 1 ? -Math.PI / 2 : Math.PI;
}
