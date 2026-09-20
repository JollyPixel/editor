// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXES,
  AXIS_COLOR
} from "../common/axes.ts";
import { eyeDirection } from "../common/eyeDirection.ts";
import { screenScaleFactor } from "../common/screenScaleFactor.ts";
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
  GizmoHandleStyle,
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
  TransformAxisAppearanceOptions,
  TransformAxisHandleOptions,
  TransformDirectionPolicy,
  TransformGizmoAppearanceOptions,
  TransformHandle,
  TransformMode
} from "./types.ts";

// CONSTANTS
const kDefaultDirections: TransformDirectionPolicy = "positive";
const kDefaultTranslateHandle: TransformAxisHandleOptions = {
  kind: "arrow"
};
const kDefaultScaleHandle: TransformAxisHandleOptions = {
  kind: "cube"
};

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

    this.#createHandles(options);
    this.#applyVisibility();
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

  #createHandles(
    options: TransformGizmoAppearanceOptions
  ): void {
    const appearance = this.#appearance;
    const style: GizmoHandleStyle = {
      hoverColor: appearance.hoverColor,
      activeColor: appearance.activeColor,
      outline: appearance.outline,
      depthTest: appearance.depthTest,
      renderOrder: appearance.renderOrder
    };
    if (appearance.rings.frontOnly) {
      this.#silhouette = new SilhouetteRing({
        rings: appearance.rings,
        depthTest: appearance.depthTest,
        renderOrder: appearance.renderOrder
      });
      this.add(this.#silhouette);
    }

    for (const axis of AXES) {
      const axisAppearance = options.axes?.[axis];
      if (axisAppearance === false) {
        continue;
      }

      const overrides = axisAppearance ?? {};
      const color = overrides.color ?? AXIS_COLOR[axis];
      this.#createAxisHandles("translate", axis, overrides, options, style);
      this.#createAxisHandles("scale", axis, overrides, options, style);
      this.#register(new RingHandle({
        axis,
        rings: appearance.rings,
        pickerTube: appearance.pickerRingTube,
        color,
        style
      }));
    }
    this.#createPlaneHandles(options, style);

    if (appearance.viewRing !== false) {
      this.#register(new ViewRingHandle({
        viewRing: appearance.viewRing,
        rings: appearance.rings,
        pickerTube: appearance.pickerRingTube,
        style
      }));
    }
    if (appearance.center !== false) {
      this.#register(new CenterHandle({
        center: appearance.center,
        style
      }));
    }
  }

  #createPlaneHandles(
    options: TransformGizmoAppearanceOptions,
    style: GizmoHandleStyle
  ): void {
    const { planes } = this.#appearance;
    if (planes === false) {
      return;
    }

    function axisColor(
      axis: Axis
    ): THREE.ColorRepresentation {
      const overrides = options.axes?.[axis];

      return overrides === false || overrides === undefined
        ? AXIS_COLOR[axis]
        : overrides.color ?? AXIS_COLOR[axis];
    }

    for (const normal of AXES) {
      const excluded = PLANE_AXES[normal].some(
        (axis) => options.axes?.[axis] === false
      );
      if (excluded) {
        continue;
      }

      const color = planes.color === "blend"
        ? blendColors(PLANE_AXES[normal].map(axisColor))
        : axisColor(normal);
      for (const mode of ["translate", "scale"] as const) {
        this.#register(new PlaneHandle({
          mode,
          normal,
          planes,
          color,
          style
        }));
      }
    }
  }

  #createAxisHandles(
    mode: "translate" | "scale",
    axis: Axis,
    overrides: TransformAxisAppearanceOptions,
    options: TransformGizmoAppearanceOptions,
    style: GizmoHandleStyle
  ): void {
    const policy = overrides.directions ??
      options.directions ??
      kDefaultDirections;
    const shape = mode === "translate"
      ? overrides.handle ?? options.handle ?? kDefaultTranslateHandle
      : overrides.scaleHandle ?? options.scaleHandle ?? kDefaultScaleHandle;

    for (const direction of resolveDirections(policy)) {
      this.#register(new AxisHandle({
        mode,
        axis,
        direction,
        flippable: policy !== "both",
        gap: this.#appearance.gap,
        shape: createAxisHandleGeometry(shape),
        color: overrides.color ?? AXIS_COLOR[axis],
        pickerRadius: this.#appearance.pickerRadius,
        pickerLengthScale: this.#appearance.pickerLengthScale,
        style
      }));
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
