// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  type AxisSign,
  AXIS_DIRECTION
} from "../../common/math/axes.ts";
import { eyeDirection } from "../../common/screen/eyeDirection.ts";
import {
  PointerDrag,
  type PointerDragRelease
} from "../../common/interaction/PointerDrag.ts";
import type { SnapStep } from "../../common/math/snap.ts";
import type { BoxVolume } from "../BoxVolume.ts";
import type { BoxFace } from "../faceCenter.ts";
import {
  type BoxAxisPolicy,
  type BoxDragMode,
  type BoxFlipPolicy,
  type BoxResizePolicy,
  type BoxRotatePolicy,
  axisPolicyIncludes
} from "../types.ts";
import { AxisConstraints } from "./gestures/AxisConstraints.ts";
import { MoveDrag } from "./gestures/MoveDrag.ts";
import { ResizeDrag } from "./gestures/ResizeDrag.ts";
import { RotateDrag } from "./gestures/RotateDrag.ts";
import {
  BoxHandleSet,
  type BoxHandlePick
} from "./gizmo/BoxHandleSet.ts";

// CONSTANTS
const kDefaultHandleSize = 0.035;

const kPointer = new THREE.Vector2();
const kBounds = new THREE.Box3();
const kHit = new THREE.Vector3();
const kMin = new THREE.Vector3();
const kSize = new THREE.Vector3();
const kPreviousMin = new THREE.Vector3();
const kPreviousSize = new THREE.Vector3();
const kNormal = new THREE.Vector3();
const kPivot = new THREE.Vector3();
const kCorner = new THREE.Vector3();
const kEye = new THREE.Vector3();
const kWorld = new THREE.Vector3();
const kInverse = new THREE.Matrix4();

interface SessionBase {
  startMin: THREE.Vector3;
  startSize: THREE.Vector3;
  changed: boolean;
}

interface MoveSession extends SessionBase {
  mode: "move";
  axis: null;
  gesture: MoveDrag;
}

interface ResizeSession extends SessionBase {
  mode: "resize";
  axis: Axis;
  gesture: ResizeDrag;
}

interface RotateSession extends SessionBase {
  mode: "rotate";
  axis: "y";
  gesture: RotateDrag;
}

interface FlipSession extends SessionBase {
  mode: "flip";
  axis: Axis;
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

export interface BoxEndEvent extends BoxDragEvent {
  /**
   * At least one change was emitted and not undone by a cancel.
   */
  changed: boolean;
  /**
   * Ended by Escape or `cancel()`.
   */
  cancelled: boolean;
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
  end: BoxEndEvent;
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
  #drag: PointerDrag<DragSession>;
  #raycaster = new THREE.Raycaster();
  #parentRay = new THREE.Ray();
  #box: TBox | null = null;

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
    this.#drag = new PointerDrag<DragSession>({
      enabled: () => this.enabled,
      press: (event) => this.#claim(event),
      hover: (event) => this.#hover(event),
      drag: (session, event) => this.#applyDrag(session, event),
      cancel: (session) => this.#restore(session),
      release: (session, release) => this.#finishSession(session, release)
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
    return this.#drag.active;
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

    return from === undefined ? false : this.#drag.claim(from);
  }

  isOverHandle(
    event: PointerEvent
  ): boolean {
    const caster = this.#castPointer(event);

    return caster !== null && this.#handles.pick(caster) !== null;
  }

  cancel(): void {
    this.#drag.cancel();
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
    const caster = this.#castPointer(event);
    if (box === null || caster === null) {
      return false;
    }

    const ray = this.#toParentRay(box, caster);
    const handle = this.#handles.pick(caster);
    if (handle !== null) {
      return this.#beginHandle(event, box, ray, handle);
    }
    if (!this.#pickBody(box, ray, kHit)) {
      return false;
    }

    this.#startSession(event, {
      mode: "move",
      axis: null,
      gesture: new MoveDrag({
        min: box.position,
        hit: kHit,
        vertical: this.#isVerticalMove(event),
        verticalNormal: this.#verticalPlaneNormal(box)
      }),
      ...this.#sessionBase(box)
    });

    return true;
  }

  #hover(
    event: PointerEvent
  ): boolean {
    const box = this.#box;
    const caster = this.#castPointer(event);
    if (box === null || caster === null) {
      return false;
    }

    const handle = this.#handles.pick(caster);
    this.#handles.hover(handle);

    return handle !== null ||
      this.#pickBody(box, this.#toParentRay(box, caster), kHit);
  }

  #pickBody(
    box: BoxVolume,
    ray: THREE.Ray,
    hit: THREE.Vector3
  ): boolean {
    box.toBox3(kBounds);

    return !kBounds.containsPoint(ray.origin) &&
      ray.intersectBox(kBounds, hit) !== null;
  }

  #beginHandle(
    event: PointerEvent,
    box: BoxVolume,
    ray: THREE.Ray,
    handle: BoxHandlePick
  ): boolean {
    switch (handle.kind) {
      case "resize":
        return this.#beginResize(event, box, ray, handle.face);
      case "rotate":
        return this.#beginRotate(event, box, ray, handle.direction);
      default:
        this.#startSession(event, {
          mode: "flip",
          axis: handle.axis,
          ...this.#sessionBase(box)
        });

        return true;
    }
  }

  #beginResize(
    event: PointerEvent,
    box: BoxVolume,
    ray: THREE.Ray,
    face: BoxFace
  ): boolean {
    const gesture = ResizeDrag.begin(ray, box.position, box.copySizeTo(kSize), face);
    if (gesture === null) {
      return false;
    }

    this.#startSession(event, {
      mode: "resize",
      axis: face.axis,
      gesture,
      ...this.#sessionBase(box)
    });

    return true;
  }

  #beginRotate(
    event: PointerEvent,
    box: BoxVolume,
    ray: THREE.Ray,
    direction: AxisSign
  ): boolean {
    this.#resolvePivot(box, kPivot);
    const corner = this.#handles.copyCornerTo(box, kCorner);
    const origin = new THREE.Vector3(kPivot.x, corner.y, kPivot.z);
    const gesture = RotateDrag.begin({
      ray,
      origin,
      corner,
      eye: this.#eyeAt(box, origin, kEye),
      direction,
      press: event
    });
    if (gesture === null) {
      return false;
    }

    this.#startSession(event, {
      mode: "rotate",
      axis: "y",
      gesture,
      ...this.#sessionBase(box)
    });
    this.#handles.beginRotate(corner);

    return true;
  }

  #sessionBase(
    box: BoxVolume
  ): SessionBase {
    return {
      startMin: box.position.clone(),
      startSize: box.copySizeTo(new THREE.Vector3()),
      changed: false
    };
  }

  #startSession(
    event: PointerEvent,
    session: DragSession
  ): void {
    this.#drag.begin(event, session);
    this.dispatchEvent({
      type: "start",
      mode: session.mode,
      axis: session.axis
    });
  }

  #applyDrag(
    session: DragSession,
    event: PointerEvent
  ): void {
    const box = this.#box;
    const caster = this.#castPointer(event);
    if (box === null || caster === null) {
      return;
    }

    const ray = this.#toParentRay(box, caster);
    const free = this.snapBypass && event.altKey;
    kMin.copy(box.position);
    box.copySizeTo(kSize);
    switch (session.mode) {
      case "move":
        session.gesture.update({
          ray,
          free,
          vertical: this.#isVerticalMove(event),
          verticalNormal: this.#verticalPlaneNormal(box),
          constraints: this.#constraints(),
          axes: this.moveAxes
        }, kMin, kSize);
        this.#applyExtent(session, box);
        break;
      case "resize":
        session.gesture.update({
          ray,
          free,
          constraints: this.#constraints()
        }, kMin, kSize);
        this.#applyExtent(session, box);
        break;
      case "rotate":
        this.#applyRotate(session, ray, event);
        break;
      default:
        this.#handles.previewFlip(
          this.#isOverFlip(caster, session.axis) ? session.axis : null
        );
    }
  }

  #applyRotate(
    session: RotateSession,
    ray: THREE.Ray,
    event: PointerEvent
  ): void {
    const steps = session.gesture.update(ray, event);
    this.#handles.sweepTo(session.gesture.angle);

    for (const turns of steps) {
      if (this.#drag.session !== session) {
        return;
      }

      this.dispatchEvent({
        type: "rotate",
        axis: "y",
        turns
      });
    }
  }

  #applyExtent(
    session: DragSession,
    box: BoxVolume
  ): void {
    kPreviousMin.copy(box.position);
    box.copySizeTo(kPreviousSize);
    box.position.copy(kMin);
    if (!kSize.equals(kPreviousSize)) {
      box.size = kSize;
    }
    if (
      box.position.equals(kPreviousMin) &&
      box.copySizeTo(kSize).equals(kPreviousSize)
    ) {
      return;
    }

    session.changed = true;
    this.#dispatchChange(session, box);
  }

  #restore(
    session: DragSession
  ): void {
    const box = this.#box;
    if (box === null || !session.changed) {
      return;
    }

    box.position.copy(session.startMin);
    box.size = session.startSize;
    session.changed = false;
    this.#dispatchChange(session, box);
  }

  #dispatchChange(
    session: DragSession,
    box: BoxVolume
  ): void {
    this.dispatchEvent({
      type: "change",
      mode: session.mode,
      axis: session.axis,
      min: box.position.clone(),
      size: box.size
    });
  }

  #finishSession(
    session: DragSession,
    release: PointerDragRelease
  ): void {
    const box = this.#box;
    this.#handles.endGesture();
    if (box === null) {
      return;
    }

    if (release.event !== null && !release.cancelled) {
      this.#confirmRelease(session, release.event);
    }
    this.dispatchEvent({
      type: "end",
      mode: session.mode,
      axis: session.axis,
      min: box.position.clone(),
      size: box.size,
      changed: session.changed,
      cancelled: release.cancelled
    });
  }

  #confirmRelease(
    session: DragSession,
    event: PointerEvent
  ): void {
    if (session.mode === "rotate") {
      if (session.gesture.isClick(event)) {
        this.dispatchEvent({
          type: "rotate",
          axis: "y",
          turns: session.gesture.direction
        });
      }
    }
    else if (session.mode === "flip") {
      const caster = this.#castPointer(event);
      if (caster !== null && this.#isOverFlip(caster, session.axis)) {
        this.dispatchEvent({
          type: "flip",
          axis: session.axis
        });
      }
    }
  }

  #isOverFlip(
    caster: THREE.Raycaster,
    axis: Axis
  ): boolean {
    const handle = this.#handles.pick(caster);

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
    box: BoxVolume,
    point: THREE.Vector3,
    target: THREE.Vector3
  ): THREE.Vector3 {
    kWorld.copy(point);
    if (box.parent !== null) {
      kWorld.applyMatrix4(box.parent.matrixWorld);
    }

    return this.#toParentSpace(box, eyeDirection(this.object, kWorld, target));
  }

  #isVerticalMove(
    event: PointerEvent
  ): boolean {
    return (event.ctrlKey || event.metaKey) &&
      axisPolicyIncludes(this.moveAxes, "y");
  }

  #verticalPlaneNormal(
    box: BoxVolume
  ): THREE.Vector3 {
    this.#toParentSpace(box, this.object.getWorldDirection(kNormal));
    kNormal.y = 0;

    return kNormal.lengthSq() < 1e-6
      ? AXIS_DIRECTION.z
      : kNormal.normalize();
  }

  #toParentSpace(
    box: BoxVolume,
    direction: THREE.Vector3
  ): THREE.Vector3 {
    return box.parent === null ?
      direction :
      direction.transformDirection(kInverse.copy(box.parent.matrixWorld).invert());
  }

  #castPointer(
    event: PointerEvent
  ): THREE.Raycaster | null {
    if (this.#box === null || !this.#drag.toNdc(event, kPointer)) {
      return null;
    }

    this.#raycaster.setFromCamera(kPointer, this.object);

    return this.#raycaster;
  }

  #toParentRay(
    box: BoxVolume,
    caster: THREE.Raycaster
  ): THREE.Ray {
    this.#parentRay.copy(caster.ray);
    if (box.parent !== null) {
      this.#parentRay.applyMatrix4(kInverse.copy(box.parent.matrixWorld).invert());
    }

    return this.#parentRay;
  }

  #constraints(): AxisConstraints {
    return new AxisConstraints({
      snap: this.snap,
      minSize: this.minSize,
      bounds: this.bounds
    });
  }
}
