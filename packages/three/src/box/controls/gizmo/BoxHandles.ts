// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createArrowGeometry } from "../../../common/geometry/arrow.ts";
import {
  AXIS_COLOR,
  AXIS_DIRECTION,
  HANDLE_HIGHLIGHT_COLOR
} from "../../../common/math/axes.ts";
import {
  type BoxFace,
  faceCenter
} from "../../faceCenter.ts";
import {
  type BoxResizePolicy,
  axisPolicyIncludes
} from "../../types.ts";
import type { BoxView } from "./BoxView.ts";

// CONSTANTS
const kPickerRadius = 0.34;
const kPickerSegments = 4;
const kGapUnits = 0.15;
const kRenderOrder = 20;

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

const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

interface BoxHandleSlot extends BoxFace {
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
  anchor: THREE.Vector3;
}

export class BoxHandles extends THREE.Object3D {
  #slots: BoxHandleSlot[] = [];
  #hovered: number | null = null;
  #resizeAxes: BoxResizePolicy = "xz";
  #activeCount = kGroundSlotCount;
  #arrows: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #pickers: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #disposed = false;

  constructor() {
    super();

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

  get resizeAxes(): BoxResizePolicy {
    return this.#resizeAxes;
  }

  set resizeAxes(
    policy: BoxResizePolicy
  ) {
    this.#resizeAxes = policy;
    this.#activeCount = activeSlotCount(policy);
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

  face(
    view: BoxView
  ): void {
    const scale = view.handleScale(kOrigin);
    _scale.setScalar(scale);

    for (let index = 0; index < this.#slots.length; index++) {
      const slot = this.#slots[index];
      faceCenter(kOrigin, view.size, slot, slot.anchor);
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
    this.#pickers.computeBoundingSphere();
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

function activeSlotCount(
  policy: BoxResizePolicy
): number {
  if (policy === "none") {
    return 0;
  }

  return axisPolicyIncludes(policy, "y") ? kSlots.length : kGroundSlotCount;
}
