// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXES,
  AXIS_COLOR,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import {
  isOrthographicCamera,
  isPerspectiveCamera
} from "../../common/cameras.ts";
import { eyeDirection } from "../../common/eyeDirection.ts";
import { screenScaleFactor } from "../../common/screenScaleFactor.ts";
import { BoxVolume } from "../BoxVolume.ts";
import {
  type BoxFlipPolicy,
  type BoxResizePolicy,
  axisPolicyIncludes
} from "../types.ts";
import { BoxFlipChip } from "./BoxFlipChip.ts";

// CONSTANTS
const kChipSize = 1.1;
const kChipGap = 0.65;
const kArrowReach = 1.45;
const kPlaneMargin = 0.25;
const kPlaneOpacity = 0.18;
const kEdgeOpacity = 0.85;
const kRenderOrder = 19;
const kPlaneRotation: Readonly<Record<Axis, THREE.Euler>> = {
  x: new THREE.Euler(0, Math.PI / 2, 0),
  y: new THREE.Euler(-Math.PI / 2, 0, 0),
  z: new THREE.Euler(0, 0, 0)
};

const kSize = new THREE.Vector3();
const kCenter = new THREE.Vector3();
const kEye = new THREE.Vector3();
const kAnchor = new THREE.Vector3();
const kTip = new THREE.Vector3();
const kInverse = new THREE.Matrix4();

export interface BoxFlipHandlesOptions {
  camera: THREE.Camera;
  handleSize: number;
}

export class BoxFlipHandles extends THREE.Object3D {
  #camera: THREE.Camera;
  #handleSize: number;
  #chips: BoxFlipChip[];
  #plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  #edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  #flipAxes: BoxFlipPolicy = "none";
  #resizeAxes: BoxResizePolicy = "xz";
  #hovered: Axis | null = null;
  #disposed = false;

  constructor(
    options: BoxFlipHandlesOptions
  ) {
    super();

    this.name = "box-handle-flip";
    this.#camera = options.camera;
    this.#handleSize = options.handleSize;
    this.#chips = AXES.map((axis) => new BoxFlipChip(axis));

    const geometry = new THREE.PlaneGeometry(1, 1);
    this.#plane = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        opacity: kPlaneOpacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      })
    );
    this.#plane.name = "box-mirror-plane";
    this.#edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        opacity: kEdgeOpacity,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    );
    this.#plane.add(this.#edges);
    this.#plane.visible = false;

    for (const object of [this.#plane, this.#edges]) {
      object.renderOrder = kRenderOrder;
      object.frustumCulled = false;
    }
    this.add(this.#plane, ...this.#chips);
    this.flipAxes = "none";
  }

  get flipAxes(): BoxFlipPolicy {
    return this.#flipAxes;
  }

  set flipAxes(
    policy: BoxFlipPolicy
  ) {
    this.#flipAxes = policy;
    for (const chip of this.#chips) {
      chip.visible = axisPolicyIncludes(policy, chip.axis);
    }
    if (this.#hovered !== null && !axisPolicyIncludes(policy, this.#hovered)) {
      this.hover(null);
    }
  }

  set resizeAxes(
    policy: BoxResizePolicy
  ) {
    this.#resizeAxes = policy;
  }

  get pickers(): THREE.Object3D[] {
    return this.#chips.filter((chip) => chip.visible);
  }

  resolve(
    intersection: THREE.Intersection
  ): Axis | null {
    const chip = this.#chips.find(
      (candidate) => candidate === intersection.object
    );

    return chip !== undefined && chip.visible ? chip.axis : null;
  }

  hover(
    axis: Axis | null
  ): void {
    if (axis === this.#hovered) {
      return;
    }

    this.#hovered = axis;
    for (const chip of this.#chips) {
      chip.highlighted = chip.axis === axis;
    }

    this.#plane.visible = axis !== null;
    if (axis !== null) {
      this.#plane.material.color.set(AXIS_COLOR[axis]);
      this.#edges.material.color.set(AXIS_COLOR[axis]);
      this.#plane.rotation.copy(kPlaneRotation[axis]);
    }
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const parent = this.parent;
    if (parent instanceof BoxVolume) {
      this.#layout(parent);
    }

    super.updateMatrixWorld(force);
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const chip of this.#chips) {
      chip.dispose();
    }
    this.#plane.geometry.dispose();
    this.#plane.material.dispose();
    this.#edges.geometry.dispose();
    this.#edges.material.dispose();
    this.clear();
  }

  #layout(
    box: BoxVolume
  ): void {
    box.copySizeTo(kSize);
    kCenter
      .copy(kSize)
      .multiplyScalar(0.5)
      .applyMatrix4(box.matrixWorld);
    eyeDirection(this.#camera, kCenter, kEye).transformDirection(
      kInverse.copy(box.matrixWorld).invert()
    );

    for (const chip of this.#chips) {
      if (chip.visible) {
        this.#placeChip(box, chip);
      }
    }

    if (this.#hovered !== null) {
      this.#placePlane(this.#hovered);
    }
  }

  #placeChip(
    box: BoxVolume,
    chip: BoxFlipChip
  ): void {
    const { axis } = chip;
    const sign = kEye[axis] >= 0 ? 1 : -1;
    kAnchor.copy(kSize).multiplyScalar(0.5);
    kAnchor[axis] = sign === 1 ? kSize[axis] : 0;
    kTip.copy(kAnchor).applyMatrix4(box.matrixWorld);

    const scale = screenScaleFactor(this.#camera, kTip) * this.#handleSize;
    const reach = axisPolicyIncludes(this.#resizeAxes, axis) ?
      kChipGap + kArrowReach :
      kChipGap;
    kAnchor[axis] += sign * reach * scale;
    chip.position.copy(kAnchor);
    chip.scale.set(kChipSize * scale, kChipSize * scale, 1);
    chip.material.rotation = this.#screenAngle(box, kAnchor, axis);
  }

  #placePlane(
    axis: Axis
  ): void {
    this.#plane.position.copy(kSize).multiplyScalar(0.5);

    const [width, height] = planeExtent(axis);
    this.#plane.scale.set(
      kSize[width] + (kPlaneMargin * 2),
      kSize[height] + (kPlaneMargin * 2),
      1
    );
  }

  #screenAngle(
    box: BoxVolume,
    local: THREE.Vector3,
    axis: Axis
  ): number {
    const from = kCenter.copy(local).applyMatrix4(box.matrixWorld);
    const to = kTip
      .copy(local)
      .add(AXIS_DIRECTION[axis])
      .applyMatrix4(box.matrixWorld);
    from.project(this.#camera);
    to.project(this.#camera);

    return Math.atan2(
      to.y - from.y,
      (to.x - from.x) * cameraAspect(this.#camera)
    );
  }
}

function planeExtent(
  axis: Axis
): [Axis, Axis] {
  switch (axis) {
    case "x":
      return ["z", "y"];
    case "y":
      return ["x", "z"];
    default:
      return ["x", "y"];
  }
}

function cameraAspect(
  camera: THREE.Camera
): number {
  if (isPerspectiveCamera(camera)) {
    return camera.aspect;
  }
  if (isOrthographicCamera(camera)) {
    return (camera.right - camera.left) / (camera.top - camera.bottom);
  }

  return 1;
}
