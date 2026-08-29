// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  isOrthographicCamera,
  isPerspectiveCamera
} from "../common/cameras.ts";
import { mergePositions } from "../common/mergePositions.ts";
import { AreaBox } from "./AreaBox.ts";
import {
  type AreaAxis,
  type AreaAxisPolicy,
  type AreaHandleSign,
  axisPolicyIncludes
} from "./types.ts";

// CONSTANTS
const kShaftRadius = 0.045;
const kShaftLength = 0.75;
const kShaftSegments = 6;
const kHeadRadius = 0.16;
const kHeadLength = 0.4;
const kHeadSegments = 10;
const kPickerRadius = 0.34;
const kPickerLength = kShaftLength + kHeadLength;
const kGapUnits = 0.15;
const kMaxPerspectiveFactor = 7;

/*
 * Ground-axis slots stay first so instance counts can hide the Y arrows.
 */
const kGroundSlotCount = 4;
const kSlotCount = 6;
const kSlots: readonly { axis: AreaAxis; sign: AreaHandleSign; }[] = [
  { axis: "x", sign: 1 },
  { axis: "x", sign: -1 },
  { axis: "z", sign: 1 },
  { axis: "z", sign: -1 },
  { axis: "y", sign: 1 },
  { axis: "y", sign: -1 }
];

const kAxisColor: Record<AreaAxis, number> = {
  x: 0xFF6B6B,
  y: 0x7EE787,
  z: 0x6FB3FF
};
const kHoverColor = 0xFFD452;

const kUpAxis = new THREE.Vector3(0, 1, 0);
const kAxisDirection: Record<AreaAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

const _anchor = new THREE.Vector3();
const _cameraPosition = new THREE.Vector3();
const _size = new THREE.Vector3();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

export type { AreaHandleSign };

export interface AreaHandleTarget {
  axis: AreaAxis;
  sign: AreaHandleSign;
}

interface AreaHandleSlot extends AreaHandleTarget {
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
  anchor: THREE.Vector3;
}

export interface AreaBoxHandlesOptions {
  camera: THREE.Camera;
  handleSize?: number;
}

export class AreaBoxHandles extends THREE.Object3D {
  #camera: THREE.Camera;
  #handleSize: number;
  #slots: AreaHandleSlot[] = [];
  #hovered: number | null = null;
  #resizeAxes: AreaAxisPolicy = "xz";
  #activeCount = kGroundSlotCount;
  #arrows: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #pickers: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #disposed = false;

  constructor(
    options: AreaBoxHandlesOptions
  ) {
    super();

    const { camera, handleSize = 0.035 } = options;
    this.#camera = camera;
    this.#handleSize = handleSize;

    this.#arrows = new THREE.InstancedMesh(
      createArrowGeometry(),
      new THREE.MeshBasicMaterial({
        depthTest: false,
        transparent: true
      }),
      kSlotCount
    );
    this.#arrows.renderOrder = 20;
    this.#arrows.frustumCulled = false;

    this.#pickers = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(
        kPickerRadius,
        kPickerRadius,
        kPickerLength,
        4
      ).translate(0, kPickerLength / 2, 0),
      new THREE.MeshBasicMaterial({ visible: false }),
      kSlotCount
    );
    this.#pickers.visible = false;
    this.#pickers.frustumCulled = false;

    for (const { axis, sign } of kSlots) {
      const direction = kAxisDirection[axis].clone().multiplyScalar(sign);
      this.#slots.push({
        axis,
        sign,
        direction,
        quaternion: new THREE.Quaternion().setFromUnitVectors(
          kUpAxis,
          direction
        ),
        anchor: new THREE.Vector3()
      });
    }

    this.#paintAxisColors();
    this.add(this.#arrows, this.#pickers);
  }

  get pickers(): THREE.Object3D[] {
    return [this.#pickers];
  }

  resolve(
    intersection: THREE.Intersection
  ): AreaHandleTarget | null {
    const { instanceId } = intersection;
    if (
      intersection.object !== this.#pickers ||
      instanceId === undefined ||
      instanceId === null ||
      instanceId >= this.#activeCount
    ) {
      return null;
    }

    const { axis, sign } = this.#slots[instanceId];

    return { axis, sign };
  }

  layout(
    size: THREE.Vector3
  ): void {
    for (const slot of this.#slots) {
      const { axis, sign } = slot;
      slot.anchor.set(size.x / 2, size.y / 2, size.z / 2);
      slot.anchor[axis] = sign === 1 ? size[axis] : 0;
    }
  }

  get resizeAxes(): AreaAxisPolicy {
    return this.#resizeAxes;
  }

  set resizeAxes(
    policy: AreaAxisPolicy
  ) {
    this.#resizeAxes = policy;
    this.#activeCount = axisPolicyIncludes(policy, "y")
      ? kSlotCount
      : kGroundSlotCount;
    this.#arrows.count = this.#activeCount;
    this.#pickers.count = this.#activeCount;
  }

  hover(
    target: AreaHandleTarget | null
  ): void {
    const hovered = target === null
      ? null
      : this.#slots.findIndex(
        (slot) => slot.axis === target.axis && slot.sign === target.sign
      );

    if (hovered === this.#hovered) {
      return;
    }

    this.#hovered = hovered === -1 ? null : hovered;
    this.#paintAxisColors();
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const parent = this.parent;
    if (parent instanceof AreaBox) {
      this.layout(parent.copySizeTo(_size));
    }

    const scale = this.#screenScaleFactor() * this.#handleSize;
    _scale.setScalar(scale);

    for (let index = 0; index < this.#slots.length; index++) {
      const slot = this.#slots[index];
      _position
        .copy(slot.direction)
        .multiplyScalar(scale * kGapUnits)
        .add(slot.anchor);
      _matrix.compose(_position, slot.quaternion, _scale);

      this.#arrows.setMatrixAt(index, _matrix);
      this.#pickers.setMatrixAt(index, _matrix);
    }
    this.#arrows.instanceMatrix.needsUpdate = true;
    this.#pickers.instanceMatrix.needsUpdate = true;
    /*
     * Recompute the bounding sphere cached by InstancedMesh.raycast.
     */
    this.#pickers.computeBoundingSphere();

    super.updateMatrixWorld(force);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#arrows.geometry.dispose();
    this.#arrows.material.dispose();
    this.#arrows.dispose();
    this.#pickers.geometry.dispose();
    this.#pickers.material.dispose();
    this.#pickers.dispose();
    this.#slots = [];
    this.clear();
  }

  #paintAxisColors(): void {
    for (let index = 0; index < this.#slots.length; index++) {
      _color.setHex(
        index === this.#hovered
          ? kHoverColor
          : kAxisColor[this.#slots[index].axis]
      );
      this.#arrows.setColorAt(index, _color);
    }

    if (this.#arrows.instanceColor) {
      this.#arrows.instanceColor.needsUpdate = true;
    }
  }

  #screenScaleFactor(): number {
    const camera = this.#camera;
    _cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    /*
     * The parent's world matrix is current before this node calls super.
     */
    _anchor.setFromMatrixPosition(
      this.parent?.matrixWorld ?? this.matrixWorld
    );

    const distance = _anchor.distanceTo(_cameraPosition);
    if (isOrthographicCamera(camera)) {
      const { top, bottom, zoom } = camera;

      return (top - bottom) / zoom;
    }
    if (!isPerspectiveCamera(camera)) {
      return distance;
    }

    const { fov, zoom } = camera;

    return distance * Math.min(
      1.9 * Math.tan((Math.PI * fov) / 360) / zoom,
      kMaxPerspectiveFactor
    );
  }
}

function createArrowGeometry(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(
    kShaftRadius,
    kShaftRadius,
    kShaftLength,
    kShaftSegments,
    1,
    true
  ).translate(0, kShaftLength / 2, 0);

  const head = new THREE.ConeGeometry(
    kHeadRadius,
    kHeadLength,
    kHeadSegments
  ).translate(0, kShaftLength + (kHeadLength / 2), 0);

  const merged = mergePositions([shaft, head]);
  shaft.dispose();
  head.dispose();

  return merged;
}
