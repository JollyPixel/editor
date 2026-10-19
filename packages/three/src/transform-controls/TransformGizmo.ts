// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXES
} from "../common/math/axes.ts";
import { eyeDirection } from "../common/screen/eyeDirection.ts";
import { screenScaleFactor } from "../common/screen/scaleFactor.ts";
import {
  centerReach,
  type ResolvedAppearance,
  resolveAppearance,
  resolveDirections
} from "./appearance.ts";
import { AxisHandle } from "./handles/AxisHandle.ts";
import { CenterHandle } from "./handles/CenterHandle.ts";
import { createAxisHandleGeometry } from "./handles/geometry.ts";
import type {
  GizmoHandle,
  GizmoView
} from "./handles/GizmoHandle.ts";
import {
  PLANE_AXES,
  sameHandle
} from "./handles/handleId.ts";
import { PlaneHandle } from "./handles/PlaneHandle.ts";
import { RingHandle } from "./handles/RingHandle.ts";
import { SilhouetteRing } from "./handles/SilhouetteRing.ts";
import { ViewRingHandle } from "./handles/ViewRingHandle.ts";
import type { TransformFrame } from "./TransformFrame.ts";
import type {
  TransformGizmoAppearanceOptions,
  TransformHandle,
  TransformMode
} from "./types.ts";

// CONSTANTS
const kJunctionRadius = 0.08;

const kDesiredMatrix = new THREE.Matrix4();
const kDesiredScale = new THREE.Vector3();
const kParentInverse = new THREE.Matrix4();
const kFrameInverse = new THREE.Quaternion();
const kBlendPart = new THREE.Color();

export type TransformAxesState = Record<Axis, boolean>;

export class TransformGizmo extends THREE.Object3D {
  override readonly type = "TransformGizmo";

  #camera: THREE.Camera;
  #frame: TransformFrame;
  #target: THREE.Object3D | null = null;
  #mode: TransformMode = "translate";
  #axes: TransformAxesState = {
    x: true,
    y: true,
    z: true
  };
  #appearance: ResolvedAppearance;
  #builtModes = new Set<TransformMode>();
  #handles: GizmoHandle[] = [];
  #handleByPicker = new Map<THREE.Object3D, GizmoHandle>();
  #silhouette: SilhouetteRing | null = null;
  #hovered: GizmoHandle | null = null;
  #active: GizmoHandle | null = null;
  #origin = new THREE.Vector3();
  #quaternion = new THREE.Quaternion();
  #view: GizmoView;
  #worldScale = 0;
  #disposed = false;

  constructor(
    camera: THREE.Camera,
    frame: TransformFrame,
    options: TransformGizmoAppearanceOptions = {}
  ) {
    super();

    this.#camera = camera;
    this.#frame = frame;
    this.#appearance = resolveAppearance(options);
    this.#view = {
      eye: new THREE.Vector3(0, 0, 1),
      cameraQuaternion: new THREE.Quaternion(),
      hideAligned: this.#appearance.hideAligned,
      flip: this.#appearance.flipTowardCamera
    };
    this.name = "transform-gizmo";
    this.matrixAutoUpdate = false;
    this.visible = false;
  }

  get target(): THREE.Object3D | null {
    return this.#target;
  }

  get mode(): TransformMode {
    return this.#mode;
  }

  set mode(
    mode: TransformMode
  ) {
    if (mode === this.#mode) {
      return;
    }

    this.#mode = mode;
    this.hover(null);
    this.activate(null);
    this.#createModeHandles();
    this.#applyVisibility();
  }

  get axes(): TransformAxesState {
    return { ...this.#axes };
  }

  set axes(
    axes: TransformAxesState
  ) {
    this.#axes = { ...axes };
    this.#applyVisibility();
  }

  get hoveredHandle(): TransformHandle | null {
    return this.#hovered === null ? null : { ...this.#hovered.handleId };
  }

  get activeHandle(): TransformHandle | null {
    return this.#active === null ? null : { ...this.#active.handleId };
  }

  get worldScale(): number {
    return this.#worldScale;
  }

  follow(
    target: THREE.Object3D | null
  ): void {
    this.#target = target;
    this.visible = target !== null;
    if (target === null) {
      this.hover(null);
      this.activate(null);
    }
    else {
      this.#createModeHandles();
      this.#applyVisibility();
    }
  }

  copyFrameTo(
    origin: THREE.Vector3,
    quaternion: THREE.Quaternion
  ): void {
    origin.copy(this.#origin);
    quaternion.copy(this.#quaternion);
  }

  hover(
    target: TransformHandle | null
  ): void {
    const handle = this.#findHandle(target);
    if (handle === this.#hovered) {
      return;
    }

    this.#hovered = handle;
    this.#paintStates();
  }

  activate(
    target: TransformHandle | null
  ): void {
    const handle = this.#findHandle(target);
    if (handle === this.#active) {
      return;
    }

    this.#active = handle;
    this.#paintStates();
  }

  pick(
    raycaster: THREE.Raycaster
  ): TransformHandle | null {
    if (this.#target === null || !this.visible) {
      return null;
    }

    const pickers: THREE.Object3D[] = [];
    for (const handle of this.#handles) {
      if (handle.visible && handle.picker !== null && this.#pickable(handle)) {
        pickers.push(handle.picker);
      }
    }

    const insideHub = this.#mode !== "rotate" &&
      raycaster.ray.distanceToPoint(this.#origin) <
        this.#worldScale * this.#hubRadius();
    for (const intersection of raycaster.intersectObjects(pickers, false)) {
      const handle = this.#handleByPicker.get(intersection.object);
      if (
        handle === undefined ||
        (insideHub && this.#yieldsToHub(handle)) ||
        !handle.accepts(intersection.point)
      ) {
        continue;
      }

      return { ...handle.handleId };
    }

    return null;
  }

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const target = this.#target;
    if (target === null) {
      super.updateMatrixWorld(force);

      return;
    }

    target.updateWorldMatrix(true, false);
    this.#camera.updateWorldMatrix(true, false);
    this.#frame.resolveOrigin(target, this.#origin);
    this.#frame.resolveQuaternion(
      target,
      this.#camera,
      this.#mode,
      this.#quaternion
    );

    this.#worldScale = screenScaleFactor(
      this.#camera,
      this.#origin
    ) * this.#appearance.size;
    kDesiredScale.setScalar(this.#worldScale);
    kDesiredMatrix.compose(
      this.#origin,
      this.#quaternion,
      kDesiredScale
    );

    if (this.parent === null) {
      this.matrix.copy(kDesiredMatrix);
    }
    else {
      kParentInverse.copy(this.parent.matrixWorld).invert();
      this.matrix.multiplyMatrices(kParentInverse, kDesiredMatrix);
    }

    this.matrixWorldNeedsUpdate = true;
    this.#faceCamera();
    super.updateMatrixWorld(force);
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const handle of this.#handles.splice(0)) {
      handle.dispose();
    }
    this.#handleByPicker.clear();
    this.#silhouette?.dispose();
    this.#silhouette = null;
    this.clear();
  }

  #hubRadius(): number {
    const { gap, center } = this.#appearance;
    if (center === false) {
      return Math.max(gap, kJunctionRadius);
    }

    return Math.max(gap, centerReach(center));
  }

  #faceCamera(): void {
    const view = this.#view;
    kFrameInverse.copy(this.#quaternion).invert();
    eyeDirection(this.#camera, this.#origin, view.eye)
      .applyQuaternion(kFrameInverse);
    this.#camera
      .getWorldQuaternion(view.cameraQuaternion)
      .premultiply(kFrameInverse);

    for (const handle of this.#handles) {
      handle.visible = this.#enabled(handle) && handle.face(view);
    }
    this.#silhouette?.face(view);
  }

  #applyVisibility(): void {
    for (const handle of this.#handles) {
      handle.visible = this.#enabled(handle);
    }
    if (this.#silhouette !== null) {
      this.#silhouette.visible = this.#mode === "rotate";
    }
  }

  #enabled(
    handle: GizmoHandle
  ): boolean {
    return handle.modes.includes(this.#mode) &&
      handle.axes.every((axis) => this.#axes[axis]);
  }

  #yieldsToHub(
    handle: GizmoHandle
  ): boolean {
    const { center } = this.#appearance;
    const { kind } = handle.handleId;

    return kind === "axis" ||
      (kind === "plane" && center !== false && center.interactive);
  }

  #pickable(
    handle: GizmoHandle
  ): boolean {
    return handle.handleId.kind !== "center" || this.#mode !== "rotate";
  }

  #createModeHandles(): void {
    const mode = this.#mode;
    if (
      this.#target === null ||
      this.#disposed ||
      this.#builtModes.has(mode)
    ) {
      return;
    }

    if (mode === "rotate") {
      this.#createRotateHandles();
    }
    else {
      this.#createAxisHandles(mode);
      this.#createPlaneHandles(mode);
    }
    if (this.#builtModes.size === 0) {
      this.#createCenterHandle();
    }
    this.#builtModes.add(mode);
  }

  #createCenterHandle(): void {
    const { center, style } = this.#appearance;
    if (center !== false) {
      this.#register(new CenterHandle({
        center,
        style
      }));
    }
  }

  #createRotateHandles(): void {
    const appearance = this.#appearance;
    const { style } = appearance;
    if (appearance.rings.frontOnly) {
      this.#silhouette = new SilhouetteRing({
        rings: appearance.rings,
        depthTest: style.depthTest,
        renderOrder: style.renderOrder
      });
      this.add(this.#silhouette);
    }

    for (const axis of AXES) {
      const { excluded, color } = appearance.axes[axis];
      if (excluded) {
        continue;
      }

      this.#register(new RingHandle({
        axis,
        rings: appearance.rings,
        pickerTube: appearance.pickerRingTube,
        color,
        style
      }));
    }

    if (appearance.viewRing !== false) {
      this.#register(new ViewRingHandle({
        viewRing: appearance.viewRing,
        rings: appearance.rings,
        pickerTube: appearance.pickerRingTube,
        style
      }));
    }
  }

  #createPlaneHandles(
    mode: "translate" | "scale"
  ): void {
    const { planes, axes, style } = this.#appearance;
    if (planes === false) {
      return;
    }

    for (const normal of AXES) {
      const spanned = PLANE_AXES[normal];
      if (spanned.some((axis) => axes[axis].excluded)) {
        continue;
      }

      this.#register(new PlaneHandle({
        mode,
        normal,
        planes,
        color: planes.color === "blend"
          ? blendColors(spanned.map((axis) => axes[axis].color))
          : axes[normal].color,
        style
      }));
    }
  }

  #createAxisHandles(
    mode: "translate" | "scale"
  ): void {
    const appearance = this.#appearance;
    for (const axis of AXES) {
      const {
        excluded,
        color,
        directions,
        shapes
      } = appearance.axes[axis];
      if (excluded) {
        continue;
      }

      for (const direction of resolveDirections(directions)) {
        this.#register(new AxisHandle({
          mode,
          axis,
          direction,
          flippable: directions !== "both",
          gap: appearance.gap,
          shape: createAxisHandleGeometry(shapes[mode]),
          color,
          pickerRadius: appearance.pickerRadius,
          pickerLengthScale: appearance.pickerLengthScale,
          style: appearance.style
        }));
      }
    }
  }

  #register(
    handle: GizmoHandle
  ): void {
    this.#handles.push(handle);
    if (handle.picker !== null) {
      this.#handleByPicker.set(handle.picker, handle);
    }
    this.add(handle);
  }

  #findHandle(
    target: TransformHandle | null
  ): GizmoHandle | null {
    if (target === null) {
      return null;
    }

    return this.#handles.find(
      (handle) => handle.modes.includes(this.#mode) &&
        sameHandle(handle.handleId, target)
    ) ?? null;
  }

  #paintStates(): void {
    for (const handle of this.#handles) {
      if (handle === this.#active) {
        handle.state = "active";
      }
      else if (handle === this.#hovered) {
        handle.state = "hovered";
      }
      else {
        handle.state = "idle";
      }
    }
  }
}

function blendColors(
  colors: THREE.ColorRepresentation[]
): THREE.Color {
  const blend = new THREE.Color(0, 0, 0);
  for (const color of colors) {
    blend.add(kBlendPart.set(color));
  }
  const peak = Math.max(blend.r, blend.g, blend.b, 1);

  return blend.multiplyScalar(1 / peak);
}
