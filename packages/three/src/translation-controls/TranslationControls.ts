// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AXIS_DIRECTION } from "../common/axes.ts";
import { PointerDrag } from "../common/PointerDrag.ts";
import {
  snapStepFor,
  snapValue
} from "../common/snap.ts";
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

  #drag: PointerDrag;
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
    this.#drag = new PointerDrag({
      press: (event) => this.#claim(event),
      hover: (event) => this.#hover(event),
      drag: (event) => this.#applyDrag(event),
      release: () => this.#finishSession()
    });

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
    snap: number | THREE.Vector3Like | null
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

    this.#drag.end();
    this.#target = target;
    this.#gizmo.setTarget(target);
  }

  detach(): void {
    if (this.#target === null) {
      return;
    }

    this.#drag.end();
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
    super.connect(element);
    this.#drag.connect(element);
  }

  override disconnect(): void {
    this.#drag.disconnect();
    this.domElement = null;
  }

  override dispose(): void {
    this.detach();
    this.disconnect();
    this.#gizmo.dispose();
  }

  #claim(
    event: PointerEvent
  ): void {
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
  }

  #hover(
    event: PointerEvent
  ): void {
    if (!this.enabled || this.#target === null) {
      return;
    }

    this.#gizmo.hover(this.#pick(event));
  }

  #applyDrag(
    event: PointerEvent
  ): void {
    const session = this.#session;
    if (
      !this.enabled ||
      session === null ||
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

    const distance = _intersection
      .sub(session.startWorldPosition)
      .dot(session.axisDirection) - session.startScalar;

    _worldPosition
      .copy(session.axisDirection)
      .multiplyScalar(
        event.altKey
          ? distance
          : snapValue(distance, snapStepFor(this.#snap, session.axis))
      )
      .add(session.startWorldPosition);

    if (session.target.parent !== session.parent) {
      this.#drag.end();

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
  }

  #beginSession(
    event: PointerEvent,
    target: THREE.Object3D,
    handle: TranslationHandleTarget
  ): void {
    target.updateWorldMatrix(true, false);
    target.getWorldPosition(_worldPosition);

    _axisDirection.copy(AXIS_DIRECTION[handle.axis]);
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
    this.#drag.begin(event);

    this.dispatchEvent({
      type: "start",
      ...this.#gestureEvent(session)
    });
  }

  #finishSession(): void {
    const session = this.#session;
    if (session === null) {
      return;
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
    if (!this.#drag.toNdc(event, _pointer)) {
      return false;
    }

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
