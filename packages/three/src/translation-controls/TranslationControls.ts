// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { Vector3Like } from "../types.ts";
import {
  TranslationGizmo,
  type TranslationHandleTarget
} from "./TranslationGizmo.ts";
import type {
  TranslationAxis,
  TranslationControlsEventMap,
  TranslationControlsOptions,
  TranslationDirection,
  TranslationEndEvent,
  TranslationGestureEvent,
  TranslationSpace
} from "./types.ts";

// CONSTANTS
const kAxisDirection: Record<TranslationAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};
const kProjectionEpsilon = 1e-6;

const _axisDirection = new THREE.Vector3();
const _cameraDirection = new THREE.Vector3();
const _cameraPosition = new THREE.Vector3();
const _intersection = new THREE.Vector3();
const _localPosition = new THREE.Vector3();
const _planeNormal = new THREE.Vector3();
const _pointer = new THREE.Vector2();
const _targetQuaternion = new THREE.Quaternion();
const _worldPosition = new THREE.Vector3();

interface TranslationSession {
  pointerId: number;
  target: THREE.Object3D;
  parent: THREE.Object3D | null;
  axis: TranslationAxis;
  direction: TranslationDirection;
  axisDirection: THREE.Vector3;
  plane: THREE.Plane;
  startScalar: number;
  startWorldPosition: THREE.Vector3;
  lastPosition: THREE.Vector3;
  changed: boolean;
}

/**
 * Pointer controls for translating one object along a visible axis handle.
 */
export class TranslationControls extends THREE.Controls<
  TranslationControlsEventMap,
  THREE.Camera
> {
  readonly helper: THREE.Object3D;

  #element: HTMLElement | null = null;
  #gizmo: TranslationGizmo;
  #target: THREE.Object3D | null = null;
  #space: TranslationSpace = "world";
  #snap: number | THREE.Vector3 | null = null;
  #raycaster = new THREE.Raycaster();
  #session: TranslationSession | null = null;

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement | null = null,
    options: TranslationControlsOptions = {}
  ) {
    super(camera, domElement);

    this.#gizmo = new TranslationGizmo(
      camera,
      options.appearance
    );
    this.helper = this.#gizmo;
    this.space = options.space ?? "world";
    this.snap = options.snap ?? null;

    if (domElement !== null) {
      this.connect(domElement);
    }
  }

  get camera(): THREE.Camera {
    return this.object;
  }

  get target(): THREE.Object3D | null {
    return this.#target;
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  get hoveredAxis(): TranslationAxis | null {
    return this.#gizmo.hoveredAxis;
  }

  get activeAxis(): TranslationAxis | null {
    return this.#gizmo.activeAxis;
  }

  get space(): TranslationSpace {
    return this.#space;
  }

  set space(
    space: TranslationSpace
  ) {
    if (space !== "world" && space !== "local") {
      throw new TypeError(`Unknown translation space: ${space}`);
    }

    this.#space = space;
    this.#gizmo.setSpace(space);
  }

  get snap(): number | THREE.Vector3 | null {
    return this.#snap instanceof THREE.Vector3
      ? this.#snap.clone()
      : this.#snap;
  }

  set snap(
    snap: number | Vector3Like | null
  ) {
    if (snap === null) {
      this.#snap = null;

      return;
    }
    if (typeof snap === "number") {
      this.#snap = validStep(snap, "snap");

      return;
    }

    this.#snap = new THREE.Vector3(
      validStep(snap.x, "snap.x"),
      validStep(snap.y, "snap.y"),
      validStep(snap.z, "snap.z")
    );
  }

  attach(
    target: THREE.Object3D
  ): void {
    if (target === this.#target) {
      return;
    }

    this.#endSession();
    this.#target = target;
    this.#gizmo.setTarget(target);
  }

  detach(): void {
    if (this.#target === null) {
      return;
    }

    this.#endSession();
    this.#target = null;
    this.#gizmo.setTarget(null);
  }

  isOverHandle(
    event: PointerEvent
  ): boolean {
    return this.#pick(event) !== null;
  }

  override connect(
    element: HTMLElement
  ): void {
    if (element === this.#element) {
      return;
    }
    if (this.#element !== null) {
      this.disconnect();
    }

    super.connect(element);
    this.#element = element;
    element.addEventListener("pointerdown", this.#onPointerDown);
    element.addEventListener("pointermove", this.#onPointerHover);
  }

  override disconnect(): void {
    const element = this.#element;
    if (element === null) {
      return;
    }

    this.#endSession();
    element.removeEventListener("pointerdown", this.#onPointerDown);
    element.removeEventListener("pointermove", this.#onPointerHover);
    this.#element = null;
    this.domElement = null;
  }

  override dispose(): void {
    this.detach();
    this.disconnect();
    this.#gizmo.dispose();
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    if (
      !this.enabled ||
      event.button !== 0 ||
      this.#session !== null
    ) {
      return;
    }

    const target = this.#target;
    const handle = this.#pick(event);
    if (target === null || handle === null) {
      return;
    }

    this.#beginSession(event, target, handle);
  };

  readonly #onPointerHover = (
    event: PointerEvent
  ): void => {
    if (
      !this.enabled ||
      this.#target === null ||
      this.#session !== null
    ) {
      return;
    }

    this.#gizmo.hover(this.#pick(event));
  };

  readonly #onPointerMove = (
    event: PointerEvent
  ): void => {
    const session = this.#session;
    if (
      !this.enabled ||
      session === null ||
      event.pointerId !== session.pointerId ||
      !this.#updateRay(event)
    ) {
      return;
    }

    if (
      this.#raycaster.ray.intersectPlane(
        session.plane,
        _intersection
      ) === null
    ) {
      return;
    }

    let distance = _intersection
      .sub(session.startWorldPosition)
      .dot(session.axisDirection) - session.startScalar;
    const step = this.#stepFor(session.axis);
    if (!event.altKey && step !== null) {
      distance = Math.round(distance / step) * step;
    }

    _worldPosition
      .copy(session.axisDirection)
      .multiplyScalar(distance)
      .add(session.startWorldPosition);

    if (session.target.parent !== session.parent) {
      this.#endSession();

      return;
    }

    if (session.parent === null) {
      _localPosition.copy(_worldPosition);
    }
    else {
      session.parent.updateWorldMatrix(true, false);
      _localPosition.copy(_worldPosition);
      session.parent.worldToLocal(_localPosition);
    }

    if (_localPosition.equals(session.lastPosition)) {
      return;
    }

    session.target.position.copy(_localPosition);
    session.lastPosition.copy(_localPosition);
    session.changed = true;
    this.#updateGizmo();
    this.dispatchEvent({
      type: "change",
      ...this.#gestureEvent(session),
      changed: true
    });
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (this.#session?.pointerId !== event.pointerId) {
      return;
    }

    this.#endSession();
  };

  #beginSession(
    event: PointerEvent,
    target: THREE.Object3D,
    handle: TranslationHandleTarget
  ): void {
    target.updateWorldMatrix(true, false);
    target.getWorldPosition(_worldPosition);

    _axisDirection.copy(kAxisDirection[handle.axis]);
    if (this.#space === "local") {
      target.getWorldQuaternion(_targetQuaternion);
      _axisDirection.applyQuaternion(_targetQuaternion).normalize();
    }

    this.#cameraDirectionFrom(_worldPosition);
    _planeNormal
      .copy(_cameraDirection)
      .addScaledVector(
        _axisDirection,
        -_cameraDirection.dot(_axisDirection)
      );
    if (_planeNormal.lengthSq() < kProjectionEpsilon) {
      return;
    }
    _planeNormal.normalize();

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      _planeNormal,
      _worldPosition
    );
    if (
      this.#raycaster.ray.intersectPlane(
        plane,
        _intersection
      ) === null
    ) {
      return;
    }

    const startWorldPosition = _worldPosition.clone();
    const session: TranslationSession = {
      pointerId: event.pointerId,
      target,
      parent: target.parent,
      axis: handle.axis,
      direction: handle.direction,
      axisDirection: _axisDirection.clone(),
      plane,
      startScalar: _intersection
        .sub(startWorldPosition)
        .dot(_axisDirection),
      startWorldPosition,
      lastPosition: target.position.clone(),
      changed: false
    };
    this.#session = session;
    this.#gizmo.hover(null);
    this.#gizmo.activate(handle);

    const element = this.#element;
    if (element !== null) {
      element.addEventListener("pointermove", this.#onPointerMove);
      element.addEventListener("pointerup", this.#onPointerUp);
      element.addEventListener("pointercancel", this.#onPointerUp);
      element.setPointerCapture?.(event.pointerId);
    }

    this.dispatchEvent({
      type: "start",
      ...this.#gestureEvent(session)
    });
  }

  #endSession(): void {
    const session = this.#session;
    if (session === null) {
      return;
    }

    const element = this.#element;
    if (element !== null) {
      element.removeEventListener("pointermove", this.#onPointerMove);
      element.removeEventListener("pointerup", this.#onPointerUp);
      element.removeEventListener("pointercancel", this.#onPointerUp);
      if (element.hasPointerCapture?.(session.pointerId)) {
        element.releasePointerCapture(session.pointerId);
      }
    }

    this.#session = null;
    this.#gizmo.activate(null);
    const event: TranslationEndEvent = {
      ...this.#gestureEvent(session),
      changed: session.changed
    };
    this.dispatchEvent({
      type: "end",
      ...event
    });
  }

  #pick(
    event: PointerEvent
  ): TranslationHandleTarget | null {
    if (
      !this.enabled ||
      this.#target === null ||
      !this.#updateRay(event)
    ) {
      return null;
    }

    this.#updateGizmo();

    return this.#gizmo.pick(this.#raycaster);
  }

  #updateRay(
    event: PointerEvent
  ): boolean {
    const element = this.#element;
    if (element === null) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    _pointer.set(
      (((event.clientX - rect.left) / rect.width) * 2) - 1,
      (-((event.clientY - rect.top) / rect.height) * 2) + 1
    );
    this.#raycaster.setFromCamera(_pointer, this.object);

    return true;
  }

  #updateGizmo(): void {
    this.#gizmo.parent?.updateWorldMatrix(true, false);
    this.#gizmo.updateMatrixWorld(true);
  }

  #cameraDirectionFrom(
    worldPosition: THREE.Vector3
  ): void {
    if (this.object instanceof THREE.OrthographicCamera) {
      this.object.getWorldDirection(_cameraDirection).negate();

      return;
    }

    _cameraPosition.setFromMatrixPosition(this.object.matrixWorld);
    _cameraDirection
      .subVectors(_cameraPosition, worldPosition)
      .normalize();
  }

  #stepFor(
    axis: TranslationAxis
  ): number | null {
    if (this.#snap === null || typeof this.#snap === "number") {
      return this.#snap;
    }

    return this.#snap[axis];
  }

  #gestureEvent(
    session: TranslationSession
  ): TranslationGestureEvent {
    session.target.updateWorldMatrix(true, false);
    session.target.getWorldPosition(_worldPosition);

    return {
      axis: session.axis,
      direction: session.direction,
      position: session.target.position.clone(),
      worldPosition: _worldPosition.clone()
    };
  }
}

function validStep(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Translation ${label} must be greater than zero`);
  }

  return value;
}
