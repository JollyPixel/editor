// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createArrowGeometry } from "../../common/arrowGeometry.ts";
import {
  AXIS_COLOR,
  AXIS_DIRECTION,
  HANDLE_HIGHLIGHT_COLOR
} from "../../common/axes.ts";
import { screenScaleFactor } from "../../common/screenScaleFactor.ts";
import { BoxVolume } from "../BoxVolume.ts";
import {
  type BoxFace,
  faceCenter
} from "../faceCenter.ts";
import {
  type BoxAxisPolicy,
  axisPolicyIncludes
} from "../types.ts";

// CONSTANTS
const kPickerRadius = 0.34;
const kPickerSegments = 4;
const kGapUnits = 0.15;
const kRenderOrder = 20;

/*
 * Ground-axis slots stay first so instance counts can hide the Y arrows.
 */
const kGroundSlotCount = 4;
const kSlots: readonly BoxFace[] = [
  { axis: "x", sign: 1 },
  { axis: "x", sign: -1 },
  { axis: "z", sign: 1 },
  { axis: "z", sign: -1 },
  { axis: "y", sign: 1 },
  { axis: "y", sign: -1 }
];

const kOrigin = new THREE.Vector3();

const _anchor = new THREE.Vector3();
const _size = new THREE.Vector3();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

interface BoxHandleSlot extends BoxFace {
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
  anchor: THREE.Vector3;
}

export interface BoxHandlesOptions {
  camera: THREE.Camera;
  handleSize?: number;
}

export class BoxHandles extends THREE.Object3D {
  #camera: THREE.Camera;
  #handleSize: number;
  #slots: BoxHandleSlot[] = [];
  #hovered: number | null = null;
  #resizeAxes: BoxAxisPolicy = "xz";
  #activeCount = kGroundSlotCount;
  #arrows: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #pickers: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #disposed = false;

  constructor(
    options: BoxHandlesOptions
  ) {
    super();

    const { camera, handleSize = 0.035 } = options;
    this.#camera = camera;
    this.#handleSize = handleSize;

    const arrow = createArrowGeometry();
    this.#arrows = new THREE.InstancedMesh(
      arrow.geometry,
      new THREE.MeshBasicMaterial({
        depthTest: false,
        transparent: true
      }),
      kSlots.length
    );
    this.#arrows.renderOrder = kRenderOrder;
    this.#arrows.frustumCulled = false;

    this.#pickers = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(
        kPickerRadius,
        kPickerRadius,
        arrow.length,
        kPickerSegments
      ).translate(0, arrow.length / 2, 0),
      new THREE.MeshBasicMaterial({ visible: false }),
      kSlots.length
    );
    this.#pickers.visible = false;
    this.#pickers.frustumCulled = false;

    for (const { axis, sign } of kSlots) {
      const direction = AXIS_DIRECTION[axis].clone().multiplyScalar(sign);
      this.#slots.push({
        axis,
        sign,
        direction,
        quaternion: new THREE.Quaternion().setFromUnitVectors(
          AXIS_DIRECTION.y,
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
  ): BoxFace | null {
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
      faceCenter(kOrigin, size, slot, slot.anchor);
    }
  }

  get resizeAxes(): BoxAxisPolicy {
    return this.#resizeAxes;
  }

  set resizeAxes(
    policy: BoxAxisPolicy
  ) {
    this.#resizeAxes = policy;
    this.#activeCount = axisPolicyIncludes(policy, "y")
      ? kSlots.length
      : kGroundSlotCount;
    this.#arrows.count = this.#activeCount;
    this.#pickers.count = this.#activeCount;
  }

  hover(
    target: BoxFace | null
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
    if (parent instanceof BoxVolume) {
      this.layout(parent.copySizeTo(_size));
    }

    /*
     * The parent's world matrix is current before this node calls super.
     */
    _anchor.setFromMatrixPosition(
      this.parent?.matrixWorld ?? this.matrixWorld
    );
    const scale = screenScaleFactor(
      this.#camera,
      _anchor
    ) * this.#handleSize;
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

  override dispose(): void {
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
      _color.set(
        index === this.#hovered
          ? HANDLE_HIGHLIGHT_COLOR
          : AXIS_COLOR[this.#slots[index].axis]
      );
      this.#arrows.setColorAt(index, _color);
    }

    if (this.#arrows.instanceColor) {
      this.#arrows.instanceColor.needsUpdate = true;
    }
  }
}
