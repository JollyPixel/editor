// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  type AxisSign,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import { eyeDirection } from "../../common/eyeDirection.ts";
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
  type BoxFlipPolicy,
  type BoxResizePolicy,
  type BoxRotatePolicy,
  axisPolicyIncludes
} from "../types.ts";
import { AxisConstraints } from "./AxisConstraints.ts";
import {
  BoxHandleSet,
  type BoxHandlePick
} from "./BoxHandleSet.ts";
import { closestPointOnAxis } from "./projection.ts";
import { RotateDrag } from "./RotateDrag.ts";
import {
  moveAxis,
  resizeAxis
} from "./snapping.ts";

// CONSTANTS
const kGroundAxes: readonly Axis[] = ["x", "z"];
const kVerticalAxes: readonly Axis[] = ["y"];
const kDefaultHandleSize = 0.035;

const _pointer = new THREE.Vector2();
const _bounds = new THREE.Box3();
const _hit = new THREE.Vector3();
const _point = new THREE.Vector3();
const _size = new THREE.Vector3();
const _axisOrigin = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _corner = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _world = new THREE.Vector3();

interface MoveSession {
  mode: "move";
  axis: null;
  moved: boolean;
  /**
   * Ctrl/Cmd mode, latched after the first effective change.
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

interface RotateSession {
  mode: "rotate";
  axis: "y";
  moved: boolean;
  drag: RotateDrag;
}

interface FlipSession {
  mode: "flip";
  axis: Axis;
  moved: boolean;
}

type DragSession = MoveSession | ResizeSession | RotateSession | FlipSession;

export interface BoxRotateEvent {
  axis: "y";
  turns: AxisSign;
}

export interface BoxFlipEvent {
  axis: Axis;
}

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
  rotate: BoxRotateEvent;
  flip: BoxFlipEvent;
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
   * Lets Alt suspend snapping while held.
   */
  snapBypass?: boolean;
  /**
   * Minimum extent; takes precedence over `bounds`.
   */
  minSize?: THREE.Vector3Like | null;
  /**
   * Parent-space clamp volume.
   */
  bounds?: THREE.Box3 | null;
  moveAxes?: BoxAxisPolicy;
  resizeAxes?: BoxResizePolicy;
  rotateAxes?: BoxRotatePolicy;
  flipAxes?: BoxFlipPolicy;
  pivot?: THREE.Vector3 | null;
  /**
   * Arrow size as a fraction of viewport height.
   */
  handleSize?: number;
}

/**
 * Pointer controls for moving, resizing, turning and mirroring one `BoxVolume`.
 */
export class BoxControls<
  TBox extends BoxVolume = BoxVolume
> extends THREE.Controls<BoxControlsEventMap, THREE.Camera> {
  snap: SnapStep;
  snapBypass: boolean;
  minSize: THREE.Vector3Like | null;
  bounds: THREE.Box3 | null;
  moveAxes: BoxAxisPolicy;
  pivot: THREE.Vector3 | null;

  #handles: BoxHandleSet;
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
      snapBypass = true,
      minSize = null,
      bounds = null,
      moveAxes = "xz",
      resizeAxes = "xz",
      rotateAxes = "none",
      flipAxes = "none",
      pivot = null,
      handleSize = kDefaultHandleSize
    } = options;

    this.snap = snap;
    this.snapBypass = snapBypass;
    this.minSize = minSize;
    this.bounds = bounds;
    this.moveAxes = moveAxes;
    this.pivot = pivot;

    this.#handles = new BoxHandleSet({
      camera,
      handleSize,
      pivot: (box, target) => this.#resolvePivot(box, target)
    });
    this.resizeAxes = resizeAxes;
    this.rotateAxes = rotateAxes;
    this.flipAxes = flipAxes;
    this.#drag = new PointerDrag({
      press: (event) => {
        this.#claim(event);
      },
      hover: (event) => this.#hover(event),
      drag: (event) => this.#applyDrag(event),
      release: (event) => this.#finishSession(event)
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

  get resizeAxes(): BoxResizePolicy {
    return this.#handles.resizeAxes;
  }

  set resizeAxes(
    resizeAxes: BoxResizePolicy
  ) {
    this.#handles.resizeAxes = resizeAxes;
  }

  get rotateAxes(): BoxRotatePolicy {
    return this.#handles.rotateAxes;
  }

  set rotateAxes(
    rotateAxes: BoxRotatePolicy
  ) {
    this.#handles.rotateAxes = rotateAxes;
  }

  get flipAxes(): BoxFlipPolicy {
    return this.#handles.flipAxes;
  }

  set flipAxes(
    flipAxes: BoxFlipPolicy
  ) {
    this.#handles.flipAxes = flipAxes;
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
      this.#handles.attachTo(box);
      box.state = "active";
    }

    const { from } = options;

    return from === undefined ? false : this.#claim(from);
  }

  isOverHandle(
    event: PointerEvent
  ): boolean {
    return this.#castParentRay(event) && this.#pickHandle() !== null;
  }

  detach(): void {
    const box = this.#box;
    if (box === null) {
      return;
    }

    this.#drag.end();
    this.#handles.detachFrom(box);
    box.state = "idle";
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

    const handle = this.#pickHandle();
    if (handle !== null) {
      return this.#beginHandle(event, box, handle);
    }
    if (!this.#pickBody(box, _hit)) {
      return false;
    }

    this.#beginMove(event, box, _hit);

    return true;
  }

  #hover(
    event: PointerEvent
  ): boolean {
    const box = this.#box;
    if (!this.enabled || box === null || !this.#castParentRay(event)) {
      return false;
    }

    const handle = this.#pickHandle();
    this.#handles.hover(handle);

    return handle !== null || this.#pickBody(box, _hit);
  }

  #pickBody(
    box: BoxVolume,
    hit: THREE.Vector3
  ): boolean {
    box.toBox3(_bounds);

    return !_bounds.containsPoint(this.#parentRay.origin) &&
      this.#parentRay.intersectBox(_bounds, hit) !== null;
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

    switch (session.mode) {
      case "move":
        this.#applyMove(session, box, event);
        break;
      case "resize":
        this.#applyResize(session, box, event);
        break;
      case "rotate":
        this.#applyRotate(session, event);
        break;
      default:
        this.#trackFlip(session);
    }
  }

  #pickHandle(): BoxHandlePick | null {
    return this.#handles.pick(this.#raycaster);
  }

  #beginHandle(
    event: PointerEvent,
    box: BoxVolume,
    handle: BoxHandlePick
  ): boolean {
    switch (handle.kind) {
      case "resize":
        return this.#beginResize(event, box, handle.face);
      case "rotate":
        return this.#beginRotate(event, box, handle.direction);
      default:
        this.#startSession(
          event,
          {
            mode: "flip",
            axis: handle.axis,
            moved: false
          },
          box
        );

        return true;
    }
  }

  #beginMove(
    event: PointerEvent,
    box: BoxVolume,
    hit: THREE.Vector3
  ): void {
    const vertical = this.#isVerticalMove(event);
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

  #finishSession(
    event: PointerEvent | null
  ): void {
    const session = this.#session;
    const box = this.#box;
    if (session === null) {
      return;
    }

    this.#session = null;
    this.#handles.endGesture();

    if (box !== null) {
      if (event !== null) {
        this.#confirmRelease(session, event);
      }
      this.dispatchEvent({
        type: "end",
        mode: session.mode,
        axis: session.axis,
        min: box.position.clone(),
        size: box.size
      });
    }
  }

  #confirmRelease(
    session: DragSession,
    event: PointerEvent
  ): void {
    if (session.mode === "rotate") {
      if (session.drag.isClick(event)) {
        this.dispatchEvent({
          type: "rotate",
          axis: "y",
          turns: session.drag.direction
        });
      }
    }
    else if (
      session.mode === "flip" &&
      this.#castParentRay(event) &&
      this.#isOverFlip(session.axis)
    ) {
      this.dispatchEvent({
        type: "flip",
        axis: session.axis
      });
    }
  }

  #beginRotate(
    event: PointerEvent,
    box: BoxVolume,
    direction: AxisSign
  ): boolean {
    this.#resolvePivot(box, _pivot);
    const corner = this.#handles.copyCornerTo(box, _corner);
    const origin = new THREE.Vector3(_pivot.x, corner.y, _pivot.z);
    const drag = RotateDrag.begin({
      ray: this.#parentRay,
      origin,
      corner,
      eye: this.#eyeAt(origin, _eye),
      direction,
      press: event
    });
    if (drag === null) {
      return false;
    }

    this.#startSession(
      event,
      {
        mode: "rotate",
        axis: "y",
        moved: false,
        drag
      },
      box
    );
    this.#handles.beginRotate(corner);

    return true;
  }

  #applyRotate(
    session: RotateSession,
    event: PointerEvent
  ): void {
    const steps = session.drag.update(this.#parentRay, event);
    this.#handles.sweepTo(session.drag.angle);

    for (const turns of steps) {
      if (this.#session !== session) {
        return;
      }

      session.moved = true;
      this.dispatchEvent({
        type: "rotate",
        axis: "y",
        turns
      });
    }
  }

  #trackFlip(
    session: FlipSession
  ): void {
    this.#handles.previewFlip(
      this.#isOverFlip(session.axis) ? session.axis : null
    );
  }

  #isOverFlip(
    axis: Axis
  ): boolean {
    const handle = this.#pickHandle();

    return handle?.kind === "flip" && handle.axis === axis;
  }

  #resolvePivot(
    box: BoxVolume,
    target: THREE.Vector3
  ): THREE.Vector3 {
    if (this.pivot !== null) {
      return target.copy(this.pivot);
    }

    return box
      .copySizeTo(target)
      .multiplyScalar(0.5)
      .add(box.position);
  }

  #eyeAt(
    point: THREE.Vector3,
    target: THREE.Vector3
  ): THREE.Vector3 {
    _world.copy(point);
    const parent = this.#box?.parent ?? null;
    if (parent !== null) {
      _world.applyMatrix4(parent.matrixWorld);
    }

    return eyeDirection(this.object, _world, target)
      .transformDirection(this.#parentInverse);
  }

  #applyMove(
    session: MoveSession,
    box: BoxVolume,
    event: PointerEvent
  ): void {
    const free = this.snapBypass && event.altKey;
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

    const free = this.snapBypass && event.altKey;
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
    const vertical = this.#isVerticalMove(event);
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

  #isVerticalMove(
    event: PointerEvent
  ): boolean {
    return (event.ctrlKey || event.metaKey) &&
      axisPolicyIncludes(this.moveAxes, "y");
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
