// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBox } from "./AreaBox.ts";
import {
  AreaBoxHandles,
  type AreaHandleTarget
} from "./AreaBoxHandles.ts";
import { AxisConstraints } from "./AxisConstraints.ts";
import { closestPointOnAxis } from "./projection.ts";
import {
  moveAxis,
  resizeAxis
} from "./snapping.ts";
import {
  type AreaAxis,
  type AreaAxisPolicy,
  type AreaDragMode,
  type AreaHandleSign,
  axisPolicyIncludes
} from "./types.ts";
import type { Vector3Like } from "../types.ts";

// CONSTANTS
const kGroundAxes: readonly AreaAxis[] = ["x", "z"];
const kVerticalAxes: readonly AreaAxis[] = ["y"];
const kUpVector = new THREE.Vector3(0, 1, 0);
const kFallbackNormal = new THREE.Vector3(0, 0, 1);

const _pointer = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _point = new THREE.Vector3();
const _size = new THREE.Vector3();
const _half = new THREE.Vector3();
const _axisOrigin = new THREE.Vector3();
const _axisDirection = new THREE.Vector3();
const _normal = new THREE.Vector3();

interface DragSessionBase {
  pointerId: number;
  moved: boolean;
}

interface MoveSession extends DragSessionBase {
  mode: "move";
  axis: null;
  sign: null;
  /**
   * Shift mode, latched after the first effective change.
   */
  vertical: boolean;
  grabOffset: THREE.Vector3;
  plane: THREE.Plane;
  grabPoint: THREE.Vector3;
}

interface ResizeSession extends DragSessionBase {
  mode: "resize";
  axis: AreaAxis;
  sign: AreaHandleSign;
  faceOffset: number;
}

type DragSession = MoveSession | ResizeSession;

export interface AreaBoxDragEvent {
  mode: AreaDragMode;
  axis: AreaAxis | null;
  min: THREE.Vector3;
  size: THREE.Vector3;
}

export interface AreaBoxControlsEventMap {
  start: {
    mode: AreaDragMode;
    axis: AreaAxis | null;
  };
  /**
   * Emitted once per effective move or resize step.
   */
  change: AreaBoxDragEvent;
  end: AreaBoxDragEvent;
}

export interface AreaBoxAttachOptions {
  /**
   * Selection event to claim as the first drag event.
   */
  from?: PointerEvent;
}

export interface AreaBoxControlsOptions {
  /**
   * Absolute grid step; `null` disables snapping.
   */
  snap?: number | Vector3Like | null;
  /**
   * Minimum extent; takes precedence over `bounds`.
   */
  minSize?: Vector3Like | null;
  /**
   * Parent-space clamp volume.
   */
  bounds?: THREE.Box3 | null;
  moveAxes?: AreaAxisPolicy;
  resizeAxes?: AreaAxisPolicy;
  /**
   * Arrow size as a fraction of viewport height.
   */
  handleSize?: number;
}

/**
 * Pointer controls for moving and resizing one `AreaBox`.
 */
export class AreaBoxControls extends THREE.Controls<
  AreaBoxControlsEventMap, THREE.Camera
> {
  snap: number | Vector3Like | null;
  minSize: Vector3Like | null;
  bounds: THREE.Box3 | null;
  moveAxes: AreaAxisPolicy;

  #handles: AreaBoxHandles;
  #element: HTMLElement | null = null;
  #raycaster = new THREE.Raycaster();
  #area: AreaBox | null = null;
  #session: DragSession | null = null;
  #parentRay = new THREE.Ray();
  #parentInverse = new THREE.Matrix4();
  #lastMin = new THREE.Vector3();
  #lastSize = new THREE.Vector3();

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement | null = null,
    options: AreaBoxControlsOptions = {}
  ) {
    super(camera, domElement);

    const {
      snap = 1,
      minSize = null,
      bounds = null,
      moveAxes = "xz",
      resizeAxes = "xz",
      handleSize
    } = options;

    this.snap = snap;
    this.minSize = minSize;
    this.bounds = bounds;
    this.moveAxes = moveAxes;

    this.#handles = new AreaBoxHandles({
      camera,
      handleSize
    });
    this.resizeAxes = resizeAxes;

    if (domElement !== null) {
      this.connect(domElement);
    }
  }

  get camera(): THREE.Camera {
    return this.object;
  }

  get area(): AreaBox | null {
    return this.#area;
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  get resizeAxes(): AreaAxisPolicy {
    return this.#handles.resizeAxes;
  }

  set resizeAxes(
    resizeAxes: AreaAxisPolicy
  ) {
    this.#handles.resizeAxes = resizeAxes;
  }

  /**
   * Attaches an area and optionally claims `options.from` as a drag.
   */
  attach(
    area: AreaBox,
    options: AreaBoxAttachOptions = {}
  ): boolean {
    if (area !== this.#area) {
      this.detach();
      this.#area = area;
      area.add(this.#handles);
      area.state = "active";
    }

    const { from } = options;

    return from === undefined ? false : this.#claim(from);
  }

  isOverHandle(
    event: PointerEvent
  ): boolean {
    if (
      this.#area === null ||
      !this.#castParentRay(event)
    ) {
      return false;
    }

    const hits = this.#raycaster.intersectObjects(
      this.#handles.pickers,
      false
    );
    if (hits.length === 0) {
      return false;
    }

    const target = this.#handles.resolve(hits[0]);

    return target !== null && axisPolicyIncludes(
      this.resizeAxes,
      target.axis
    );
  }

  detach(): void {
    const area = this.#area;
    if (area === null) {
      return;
    }

    this.#endSession();
    area.remove(this.#handles);
    area.state = "idle";
    this.#handles.hover(null);
    this.#area = null;
  }

  override connect(
    element: HTMLElement
  ): void {
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
    element.removeEventListener("pointermove", this.#onPointerMove);
    element.removeEventListener("pointerup", this.#onPointerUp);
    element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#element = null;
    this.domElement = null;
  }

  override dispose(): void {
    this.detach();
    this.disconnect();
    this.#handles.dispose();
  }

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    this.#claim(event);
  };

  #claim(
    event: PointerEvent
  ): boolean {
    const area = this.#area;
    if (
      !this.enabled ||
      area === null ||
      event.button !== 0 ||
      this.#session !== null ||
      !this.#castParentRay(event)
    ) {
      return false;
    }

    const handleHits = this.#raycaster.intersectObjects(
      this.#handles.pickers,
      false
    );
    if (handleHits.length > 0) {
      const target = this.#handles.resolve(handleHits[0]);
      if (
        target !== null &&
        axisPolicyIncludes(this.resizeAxes, target.axis)
      ) {
        this.#beginResize(event, area, target);

        return this.#session !== null;
      }
    }

    const bodyHits = this.#raycaster.intersectObject(
      area.fill,
      false
    );
    if (bodyHits.length > 0) {
      this.#beginMove(
        event,
        area,
        bodyHits[0].point
      );

      return true;
    }

    return false;
  }

  readonly #onPointerHover = (
    event: PointerEvent
  ): void => {
    if (
      !this.enabled ||
      this.#area === null ||
      this.#session !== null
    ) {
      return;
    }
    if (!this.#updatePointer(event)) {
      return;
    }

    this.#raycaster.setFromCamera(
      _pointer,
      this.object
    );
    const hits = this.#raycaster.intersectObjects(
      this.#handles.pickers,
      false
    );
    this.#handles.hover(
      hits.length > 0 ? this.#handles.resolve(hits[0]) : null
    );
  };

  readonly #onPointerMove = (
    event: PointerEvent
  ): void => {
    if (!this.enabled) {
      return;
    }

    const session = this.#session;
    const area = this.#area;
    if (
      session === null ||
      area === null ||
      !this.#castParentRay(event)
    ) {
      return;
    }

    if (session.mode === "move") {
      this.#applyMove(
        session,
        area,
        event
      );
    }
    else {
      this.#applyResize(
        session,
        area,
        event
      );
    }
  };

  readonly #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (this.#session?.pointerId !== event.pointerId) {
      return;
    }

    this.#endSession();
  };

  #beginMove(
    event: PointerEvent,
    area: AreaBox,
    worldHit: THREE.Vector3
  ): void {
    _hit.copy(worldHit).applyMatrix4(this.#parentInverse);

    const vertical = event.shiftKey && axisPolicyIncludes(this.moveAxes, "y");
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(
      vertical ? this.#verticalPlaneNormal() : kUpVector,
      _hit
    );

    this.#startSession(
      event,
      {
        mode: "move",
        axis: null,
        sign: null,
        vertical,
        pointerId: event.pointerId,
        grabOffset: _hit.clone().sub(area.position),
        plane,
        grabPoint: _hit.clone(),
        moved: false
      },
      area
    );
  }

  #beginResize(
    event: PointerEvent,
    area: AreaBox,
    target: AreaHandleTarget
  ): void {
    const { axis, sign } = target;
    this.#axisLine(area, axis, sign);

    const projected = closestPointOnAxis(
      this.#parentRay,
      _axisOrigin,
      _axisDirection,
      _point
    );
    if (!projected) {
      return;
    }

    this.#startSession(
      event,
      {
        mode: "resize",
        axis,
        sign,
        pointerId: event.pointerId,
        faceOffset: _point[axis] - _axisOrigin[axis],
        moved: false
      },
      area
    );
  }

  #startSession(
    event: PointerEvent,
    session: DragSession,
    area: AreaBox
  ): void {
    this.#session = session;
    this.#lastMin.copy(area.position);
    area.copySizeTo(this.#lastSize);

    const element = this.#element;
    if (element !== null) {
      element.addEventListener("pointermove", this.#onPointerMove);
      element.addEventListener("pointerup", this.#onPointerUp);
      element.addEventListener("pointercancel", this.#onPointerUp);
      element.setPointerCapture?.(event.pointerId);
    }

    this.dispatchEvent({
      type: "start",
      mode: session.mode,
      axis: session.axis
    });
  }

  #endSession(): void {
    const session = this.#session;
    const area = this.#area;
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

    if (area !== null) {
      this.dispatchEvent({
        type: "end",
        mode: session.mode,
        axis: session.axis,
        min: area.position.clone(),
        size: area.size
      });
    }
  }

  #applyMove(
    session: MoveSession,
    area: AreaBox,
    event: PointerEvent
  ): void {
    const free = event.altKey;
    this.#retargetPlane(session, event);
    if (this.#parentRay.intersectPlane(session.plane, _point) === null) {
      return;
    }

    _point.sub(session.grabOffset);
    area.copySizeTo(_size);

    const constraints = this.#constraints();
    const axes = session.vertical ? kVerticalAxes : kGroundAxes;
    for (const axis of axes) {
      if (!axisPolicyIncludes(this.moveAxes, axis)) {
        continue;
      }

      area.position[axis] = moveAxis({
        target: constraints.snapOn(axis, _point[axis], free),
        size: _size[axis],
        bounds: constraints.rangeFor(axis)
      });
    }

    this.#emitChange(session, area);
  }

  #applyResize(
    session: ResizeSession,
    area: AreaBox,
    event: PointerEvent
  ): void {
    const free = event.altKey;
    const { axis, sign } = session;
    this.#axisLine(area, axis, sign);

    const projected = closestPointOnAxis(
      this.#parentRay,
      _axisOrigin,
      _axisDirection,
      _point
    );
    if (!projected) {
      return;
    }

    area.copySizeTo(_size);
    const constraints = this.#constraints();
    const extent = resizeAxis({
      min: area.position[axis],
      size: _size[axis],
      sign,
      faceCoord: constraints.snapOn(
        axis,
        _point[axis] - session.faceOffset,
        free
      ),
      minSize: constraints.minSizeFor(axis),
      bounds: constraints.rangeFor(axis)
    });

    area.position[axis] = extent.min;
    _size[axis] = extent.size;
    area.size = _size;

    this.#emitChange(session, area);
  }

  #emitChange(
    session: DragSession,
    area: AreaBox
  ): void {
    area.copySizeTo(_size);
    if (
      area.position.equals(this.#lastMin) &&
      _size.equals(this.#lastSize)
    ) {
      return;
    }

    this.#lastMin.copy(area.position);
    this.#lastSize.copy(_size);
    session.moved = true;

    this.dispatchEvent({
      type: "change",
      mode: session.mode,
      axis: session.axis,
      min: area.position.clone(),
      size: _size.clone()
    });
  }

  #axisLine(
    area: AreaBox,
    axis: AreaAxis,
    sign: AreaHandleSign
  ): void {
    area.copySizeTo(_size);
    _half.copy(_size).multiplyScalar(0.5);
    _axisOrigin.copy(area.position).add(_half);
    _axisOrigin[axis] = area.position[axis] + (sign === 1 ? _size[axis] : 0);

    _axisDirection.set(0, 0, 0);
    _axisDirection[axis] = 1;
  }

  #retargetPlane(
    session: MoveSession,
    event: PointerEvent
  ): void {
    const vertical = event.shiftKey && axisPolicyIncludes(this.moveAxes, "y");
    if (
      session.moved ||
      vertical === session.vertical
    ) {
      return;
    }

    session.vertical = vertical;
    session.plane.setFromNormalAndCoplanarPoint(
      vertical ? this.#verticalPlaneNormal() : kUpVector,
      session.grabPoint
    );
  }

  #verticalPlaneNormal(): THREE.Vector3 {
    this.object.getWorldDirection(_normal);
    _normal.transformDirection(this.#parentInverse);
    _normal.y = 0;

    return _normal.lengthSq() < 1e-6 ? kFallbackNormal : _normal.normalize();
  }

  #castParentRay(
    event: PointerEvent
  ): boolean {
    const area = this.#area;
    if (area === null || !this.#updatePointer(event)) {
      return false;
    }

    this.#raycaster.setFromCamera(_pointer, this.object);
    if (area.parent === null) {
      this.#parentInverse.identity();
    }
    else {
      this.#parentInverse.copy(area.parent.matrixWorld).invert();
    }
    this.#parentRay
      .copy(this.#raycaster.ray)
      .applyMatrix4(this.#parentInverse);

    return true;
  }

  #updatePointer(
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

    return true;
  }

  /**
   * Snapshots the live `snap`, `minSize` and `bounds` fields.
   */
  #constraints(): AxisConstraints {
    const { snap, minSize, bounds } = this;

    return new AxisConstraints({
      snap,
      minSize,
      bounds
    });
  }
}
