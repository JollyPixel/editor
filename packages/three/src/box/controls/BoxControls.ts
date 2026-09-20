// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import { PointerDrag } from "../../common/PointerDrag.ts";
import type { SnapStep } from "../../common/snap.ts";
import type { BoxVolume } from "../BoxVolume.ts";
import {
  type BoxFace,
  faceCenter
} from "../faceCenter.ts";
import {
  type BoxAxisPolicy,
  type BoxDragMode,
  axisPolicyIncludes
} from "../types.ts";
import { AxisConstraints } from "./AxisConstraints.ts";
import { BoxHandles } from "./BoxHandles.ts";
import { closestPointOnAxis } from "./projection.ts";
import {
  moveAxis,
  resizeAxis
} from "./snapping.ts";

// CONSTANTS
const kGroundAxes: readonly Axis[] = ["x", "z"];
const kVerticalAxes: readonly Axis[] = ["y"];

const _pointer = new THREE.Vector2();
const _bounds = new THREE.Box3();
const _hit = new THREE.Vector3();
const _point = new THREE.Vector3();
const _size = new THREE.Vector3();
const _axisOrigin = new THREE.Vector3();
const _normal = new THREE.Vector3();

interface MoveSession {
  mode: "move";
  axis: null;
  moved: boolean;
  /**
   * Shift mode, latched after the first effective change.
   */
  vertical: boolean;
  grabOffset: THREE.Vector3;
  plane: THREE.Plane;
  grabPoint: THREE.Vector3;
}

interface ResizeSession extends BoxFace {
  mode: "resize";
  moved: boolean;
  faceOffset: number;
}

type DragSession = MoveSession | ResizeSession;

export interface BoxDragEvent {
  mode: BoxDragMode;
  axis: Axis | null;
  min: THREE.Vector3;
  size: THREE.Vector3;
}

export interface BoxControlsEventMap {
  start: {
    mode: BoxDragMode;
    axis: Axis | null;
  };
  /**
   * Emitted once per effective move or resize step.
   */
  change: BoxDragEvent;
  end: BoxDragEvent;
}

export interface BoxAttachOptions {
  /**
   * Selection event to claim as the first drag event.
   */
  from?: PointerEvent;
}

export interface BoxControlsOptions {
  /**
   * Absolute grid step; `null` disables snapping.
   */
  snap?: SnapStep;
  /**
   * Minimum extent; takes precedence over `bounds`.
   */
  minSize?: THREE.Vector3Like | null;
  /**
   * Parent-space clamp volume.
   */
  bounds?: THREE.Box3 | null;
  moveAxes?: BoxAxisPolicy;
  resizeAxes?: BoxAxisPolicy;
  /**
   * Arrow size as a fraction of viewport height.
   */
  handleSize?: number;
}

/**
 * Pointer controls for moving and resizing one `BoxVolume`.
 */
export class BoxControls<
  TBox extends BoxVolume = BoxVolume
> extends THREE.Controls<BoxControlsEventMap, THREE.Camera> {
  snap: SnapStep;
  minSize: THREE.Vector3Like | null;
  bounds: THREE.Box3 | null;
  moveAxes: BoxAxisPolicy;

  #handles: BoxHandles;
  #drag: PointerDrag;
  #raycaster = new THREE.Raycaster();
  #box: TBox | null = null;
  #session: DragSession | null = null;
  #parentRay = new THREE.Ray();
  #parentInverse = new THREE.Matrix4();
  #lastMin = new THREE.Vector3();
  #lastSize = new THREE.Vector3();

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement | null = null,
    options: BoxControlsOptions = {}
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

    this.#handles = new BoxHandles({
      camera,
      handleSize
    });
    this.resizeAxes = resizeAxes;
    this.#drag = new PointerDrag({
      press: (event) => {
        this.#claim(event);
      },
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

  get box(): TBox | null {
    return this.#box;
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  get resizeAxes(): BoxAxisPolicy {
    return this.#handles.resizeAxes;
  }

  set resizeAxes(
    resizeAxes: BoxAxisPolicy
  ) {
    this.#handles.resizeAxes = resizeAxes;
  }

  /**
   * Attaches a box and optionally claims `options.from` as a drag.
   */
  attach(
    box: TBox,
    options: BoxAttachOptions = {}
  ): boolean {
    if (box !== this.#box) {
      this.detach();
      this.#box = box;
      box.add(this.#handles);
      box.state = "active";
    }

    const { from } = options;

    return from === undefined ? false : this.#claim(from);
  }

  isOverHandle(
    event: PointerEvent
  ): boolean {
    return this.#castParentRay(event) && this.#pickFace() !== null;
  }

  detach(): void {
    const box = this.#box;
    if (box === null) {
      return;
    }

    this.#drag.end();
    box.remove(this.#handles);
    box.state = "idle";
    this.#handles.hover(null);
    this.#box = null;
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
    this.#handles.dispose();
  }

  #claim(
    event: PointerEvent
  ): boolean {
    const box = this.#box;
    if (
      !this.enabled ||
      box === null ||
      event.button !== 0 ||
      this.#session !== null ||
      !this.#castParentRay(event)
    ) {
      return false;
    }

    const face = this.#pickFace();
    if (face !== null) {
      return this.#beginResize(event, box, face);
    }

    box.toBox3(_bounds);
    if (
      _bounds.containsPoint(this.#parentRay.origin) ||
      this.#parentRay.intersectBox(_bounds, _hit) === null
    ) {
      return false;
    }

    this.#beginMove(event, box, _hit);

    return true;
  }

  #hover(
    event: PointerEvent
  ): void {
    if (!this.enabled || !this.#castParentRay(event)) {
      return;
    }

    this.#handles.hover(this.#pickFace());
  }

  #applyDrag(
    event: PointerEvent
  ): void {
    const session = this.#session;
    const box = this.#box;
    if (
      !this.enabled ||
      session === null ||
      box === null ||
      !this.#castParentRay(event)
    ) {
      return;
    }

    if (session.mode === "move") {
      this.#applyMove(session, box, event);
    }
    else {
      this.#applyResize(session, box, event);
    }
  }

  #pickFace(): BoxFace | null {
    const hits = this.#raycaster.intersectObjects(
      this.#handles.pickers,
      false
    );
    if (hits.length === 0) {
      return null;
    }

    const face = this.#handles.resolve(hits[0]);

    return face !== null && axisPolicyIncludes(this.resizeAxes, face.axis)
      ? face
      : null;
  }

  #beginMove(
    event: PointerEvent,
    box: BoxVolume,
    hit: THREE.Vector3
  ): void {
    const vertical = event.shiftKey && axisPolicyIncludes(this.moveAxes, "y");
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(
      vertical ? this.#verticalPlaneNormal() : AXIS_DIRECTION.y,
      hit
    );

    this.#startSession(
      event,
      {
        mode: "move",
        axis: null,
        vertical,
        grabOffset: hit.clone().sub(box.position),
        plane,
        grabPoint: hit.clone(),
        moved: false
      },
      box
    );
  }

  #beginResize(
    event: PointerEvent,
    box: BoxVolume,
    face: BoxFace
  ): boolean {
    if (!this.#projectOnFaceAxis(box, face)) {
      return false;
    }

    const { axis, sign } = face;
    this.#startSession(
      event,
      {
        mode: "resize",
        axis,
        sign,
        faceOffset: _point[axis] - _axisOrigin[axis],
        moved: false
      },
      box
    );

    return true;
  }

  #startSession(
    event: PointerEvent,
    session: DragSession,
    box: BoxVolume
  ): void {
    this.#session = session;
    this.#lastMin.copy(box.position);
    box.copySizeTo(this.#lastSize);
    this.#drag.begin(event);

    this.dispatchEvent({
      type: "start",
      mode: session.mode,
      axis: session.axis
    });
  }

  #finishSession(): void {
    const session = this.#session;
    const box = this.#box;
    if (session === null) {
      return;
    }

    this.#session = null;

    if (box !== null) {
      this.dispatchEvent({
        type: "end",
        mode: session.mode,
        axis: session.axis,
        min: box.position.clone(),
        size: box.size
      });
    }
  }

  #applyMove(
    session: MoveSession,
    box: BoxVolume,
    event: PointerEvent
  ): void {
    const free = event.altKey;
    this.#retargetPlane(session, event);
    if (this.#parentRay.intersectPlane(session.plane, _point) === null) {
      return;
    }

    _point.sub(session.grabOffset);
    box.copySizeTo(_size);

    const constraints = this.#constraints();
    const axes = session.vertical ? kVerticalAxes : kGroundAxes;
    for (const axis of axes) {
      if (!axisPolicyIncludes(this.moveAxes, axis)) {
        continue;
      }

      box.position[axis] = moveAxis({
        target: constraints.snapOn(axis, _point[axis], free),
        size: _size[axis],
        bounds: constraints.rangeFor(axis)
      });
    }

    this.#emitChange(session, box);
  }

  #applyResize(
    session: ResizeSession,
    box: BoxVolume,
    event: PointerEvent
  ): void {
    if (!this.#projectOnFaceAxis(box, session)) {
      return;
    }

    const free = event.altKey;
    const { axis, sign } = session;
    box.copySizeTo(_size);
    const constraints = this.#constraints();
    const extent = resizeAxis({
      min: box.position[axis],
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

    box.position[axis] = extent.min;
    _size[axis] = extent.size;
    box.size = _size;

    this.#emitChange(session, box);
  }

  #emitChange(
    session: DragSession,
    box: BoxVolume
  ): void {
    box.copySizeTo(_size);
    if (
      box.position.equals(this.#lastMin) &&
      _size.equals(this.#lastSize)
    ) {
      return;
    }

    this.#lastMin.copy(box.position);
    this.#lastSize.copy(_size);
    session.moved = true;

    this.dispatchEvent({
      type: "change",
      mode: session.mode,
      axis: session.axis,
      min: box.position.clone(),
      size: _size.clone()
    });
  }

  #projectOnFaceAxis(
    box: BoxVolume,
    face: BoxFace
  ): boolean {
    faceCenter(
      box.position,
      box.copySizeTo(_size),
      face,
      _axisOrigin
    );

    return closestPointOnAxis(
      this.#parentRay,
      _axisOrigin,
      AXIS_DIRECTION[face.axis],
      _point
    );
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
      vertical ? this.#verticalPlaneNormal() : AXIS_DIRECTION.y,
      session.grabPoint
    );
  }

  #verticalPlaneNormal(): THREE.Vector3 {
    this.object.getWorldDirection(_normal);
    _normal.transformDirection(this.#parentInverse);
    _normal.y = 0;

    return _normal.lengthSq() < 1e-6
      ? AXIS_DIRECTION.z
      : _normal.normalize();
  }

  #castParentRay(
    event: PointerEvent
  ): boolean {
    const box = this.#box;
    if (box === null || !this.#drag.toNdc(event, _pointer)) {
      return false;
    }

    this.#raycaster.setFromCamera(_pointer, this.object);
    if (box.parent === null) {
      this.#parentInverse.identity();
    }
    else {
      this.#parentInverse.copy(box.parent.matrixWorld).invert();
    }
    this.#parentRay
      .copy(this.#raycaster.ray)
      .applyMatrix4(this.#parentInverse);

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
