// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type AxisSign,
  AXIS_COLOR,
  AXIS_DIRECTION,
  HANDLE_HIGHLIGHT_COLOR
} from "../../../common/math/axes.ts";
import type { BoxView } from "./BoxView.ts";
import {
  createRotateArcGeometry,
  createRotateArcPickerGeometry
} from "./rotateArcGeometry.ts";

// CONSTANTS
const kRenderOrder = 20;
const kDirections: readonly AxisSign[] = [1, -1];

interface ArcHalf {
  direction: AxisSign;
  arc: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  picker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export class BoxRotateHandle extends THREE.Object3D {
  #halves: ArcHalf[] = [];
  #hovered: AxisSign | null = null;
  #disposed = false;

  constructor() {
    super();

    this.name = "box-handle-rotate";

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

  face(
    view: BoxView
  ): void {
    const { size, eye } = view;
    const signX: AxisSign = eye.x >= 0 ? 1 : -1;
    const signZ: AxisSign = eye.z >= 0 ? 1 : -1;
    this.position.set(
      signX === 1 ? size.x : 0,
      size.y,
      signZ === 1 ? size.z : 0
    );
    this.quaternion.setFromAxisAngle(
      AXIS_DIRECTION.y,
      cornerAngle(signX, signZ)
    );
    this.scale.setScalar(view.handleScale(this.position));
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
