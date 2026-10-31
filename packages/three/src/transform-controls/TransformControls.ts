// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { eyeDirection } from "../common/screen/eyeDirection.ts";
import {
  PointerDrag,
  type PointerDragRelease
} from "../common/interaction/PointerDrag.ts";
import type { SnapStep } from "../common/math/snap.ts";
import { RotateGesture } from "../common/interaction/RotateGesture.ts";
import { ScaleGesture } from "./gestures/ScaleGesture.ts";
import { TranslateGesture } from "./gestures/TranslateGesture.ts";
import {
  type GestureContext,
  rotationAxis
} from "./gestures/GestureContext.ts";
import {
  type ResolvedOrientation,
  type ResolvedPivot,
  TransformFrame
} from "./TransformFrame.ts";
import {
  type TransformAxesState,
  TransformGizmo
} from "./TransformGizmo.ts";
import type {
  TransformAxesPolicy,
  TransformControlsEventMap,
  TransformControlsOptions,
  TransformGestureEvent,
  TransformHandle,
  TransformMode,
  TransformOrientation,
  TransformPivot,
  TransformSnapOptions
} from "./types.ts";
import {
  finite,
  optionalStep,
  positive
} from "./validation.ts";

// CONSTANTS
const kModes: readonly TransformMode[] = ["translate", "rotate", "scale"];
const kPivotEpsilon = 1e-12;

const kPointer = new THREE.Vector2();
const kDelta = new THREE.Vector3();
const kFactor = new THREE.Vector3();
const kOffset = new THREE.Vector3();
const kWorldPosition = new THREE.Vector3();
const kRotation = new THREE.Quaternion();
const kFrameInverse = new THREE.Quaternion();

type TransformGesture = TranslateGesture | RotateGesture | ScaleGesture;

interface ResolvedSnap {
  translate: number | THREE.Vector3 | null;
  grid: THREE.Vector3 | null;
  rotate: number | null;
  scale: number | null;
}

interface TransformSession {
  target: THREE.Object3D;
  parent: THREE.Object3D | null;
  handle: TransformHandle;
  gesture: TransformGesture;
  origin: THREE.Vector3;
  frameQuaternion: THREE.Quaternion;
  parentWorldQuaternion: THREE.Quaternion;
  startWorldPosition: THREE.Vector3;
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  startScale: THREE.Vector3;
  lastPosition: THREE.Vector3;
  lastQuaternion: THREE.Quaternion;
  lastScale: THREE.Vector3;
  changed: boolean;
}

export class TransformControls extends THREE.Controls<
  TransformControlsEventMap,
  THREE.Camera
> {
  readonly helper: THREE.Object3D;

  limits: THREE.Box3 | null;

  #drag: PointerDrag<TransformSession>;
  #frame = new TransformFrame();
  #gizmo: TransformGizmo;
  #target: THREE.Object3D | null = null;
  #snap: ResolvedSnap = {
    translate: null,
    grid: null,
    rotate: null,
    scale: null
  };
  #raycaster = new THREE.Raycaster();

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement | null = null,
    options: TransformControlsOptions = {}
  ) {
    super(camera, domElement);

    this.#gizmo = new TransformGizmo(
      camera,
      this.#frame,
      options.appearance
    );
    this.helper = this.#gizmo;
    this.#drag = new PointerDrag<TransformSession>({
      enabled: () => this.enabled,
      press: (event) => this.#claim(event),
      hover: (event) => this.#hover(event),
      drag: (session, event) => this.#applyDrag(session, event),
      cancel: (session) => this.#restore(session),
      release: (session, release) => this.#finishSession(session, release)
    });
    this.mode = options.mode ?? "translate";
    this.orientation = options.orientation ?? "world";
    this.pivot = options.pivot ?? "origin";
    this.snap = options.snap ?? {};
    this.axes = options.axes ?? {};
    this.limits = options.limits ?? null;

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
    return this.#drag.active;
  }

  get hoveredHandle(): TransformHandle | null {
    return this.#gizmo.hoveredHandle;
  }

  get activeHandle(): TransformHandle | null {
    return this.#gizmo.activeHandle;
  }

  get mode(): TransformMode {
    return this.#gizmo.mode;
  }

  set mode(
    mode: TransformMode
  ) {
    if (!kModes.includes(mode)) {
      throw new TypeError(`Unknown transform mode: ${mode}`);
    }

    this.#drag.end();
    this.#gizmo.mode = mode;
  }

  get orientation(): ResolvedOrientation {
    return this.#frame.orientation;
  }

  set orientation(
    orientation: TransformOrientation
  ) {
    this.#frame.orientation = orientation;
  }

  get pivot(): ResolvedPivot {
    return this.#frame.pivot;
  }

  set pivot(
    pivot: TransformPivot
  ) {
    this.#frame.pivot = pivot;
  }

  get snap(): Required<TransformSnapOptions> {
    const {
      translate,
      grid,
      rotate,
      scale
    } = this.#snap;

    return {
      translate: translate instanceof THREE.Vector3
        ? translate.clone()
        : translate,
      grid: grid?.clone() ?? null,
      rotate,
      scale
    };
  }

  set snap(
    snap: TransformSnapOptions
  ) {
    this.#snap = {
      translate: resolveTranslateSnap(snap.translate ?? null),
      grid: resolveGrid(snap.grid ?? null),
      rotate: optionalStep(snap.rotate, "snap.rotate"),
      scale: optionalStep(snap.scale, "snap.scale")
    };
  }

  get axes(): TransformAxesState {
    return this.#gizmo.axes;
  }

  set axes(
    axes: TransformAxesPolicy
  ) {
    this.#drag.end();
    this.#gizmo.axes = {
      x: axes.x ?? true,
      y: axes.y ?? true,
      z: axes.z ?? true
    };
  }

  attach(
    target: THREE.Object3D
  ): void {
    if (target === this.#target) {
      return;
    }

    this.#drag.end();
    this.#target = target;
    this.#gizmo.follow(target);
  }

  detach(): void {
    if (this.#target === null) {
      return;
    }

    this.#drag.end();
    this.#target = null;
    this.#gizmo.follow(null);
  }

  cancel(): void {
    this.#drag.cancel();
  }

  #restore(
    session: TransformSession
  ): void {
    if (session.changed && session.target.parent === session.parent) {
      session.target.position.copy(session.startPosition);
      session.target.quaternion.copy(session.startQuaternion);
      session.target.scale.copy(session.startScale);
      this.#updateGizmo();
      this.dispatchEvent({
        type: "change",
        ...this.#gestureEvent(session),
        changed: true
      });
    }
    session.changed = false;
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
  ): boolean {
    const target = this.#target;
    const handle = this.#pick(event);
    if (target === null || handle === null) {
      return false;
    }

    return this.#beginSession(event, target, handle);
  }

  #hover(
    event: PointerEvent
  ): boolean {
    if (this.#target === null) {
      return false;
    }

    const handle = this.#pick(event);
    this.#gizmo.hover(handle);

    return handle !== null;
  }

  #beginSession(
    event: PointerEvent,
    target: THREE.Object3D,
    handle: TransformHandle
  ): boolean {
    const origin = new THREE.Vector3();
    const frameQuaternion = new THREE.Quaternion();
    this.#gizmo.copyFrameTo(origin, frameQuaternion);

    const context: GestureContext = {
      handle,
      ray: this.#raycaster.ray,
      origin,
      quaternion: frameQuaternion,
      eye: eyeDirection(this.object, origin, new THREE.Vector3()),
      cameraQuaternion: this.object.getWorldQuaternion(
        new THREE.Quaternion()
      ),
      size: this.#gizmo.worldScale
    };
    const gesture = this.#beginGesture(context, target);
    if (gesture === null) {
      return false;
    }

    const session: TransformSession = {
      target,
      parent: target.parent,
      handle,
      gesture,
      origin,
      frameQuaternion,
      parentWorldQuaternion: target.parent === null
        ? new THREE.Quaternion()
        : target.parent.getWorldQuaternion(new THREE.Quaternion()),
      startWorldPosition: target.getWorldPosition(new THREE.Vector3()),
      startPosition: target.position.clone(),
      startQuaternion: target.quaternion.clone(),
      startScale: target.scale.clone(),
      lastPosition: target.position.clone(),
      lastQuaternion: target.quaternion.clone(),
      lastScale: target.scale.clone(),
      changed: false
    };
    this.#gizmo.hover(null);
    this.#gizmo.activate(handle);
    this.#drag.begin(event, session);

    this.dispatchEvent({
      type: "start",
      ...this.#gestureEvent(session)
    });

    return true;
  }

  #beginGesture(
    context: GestureContext,
    target: THREE.Object3D
  ): TransformGesture | null {
    switch (this.#gizmo.mode) {
      case "rotate": {
        const axis = rotationAxis(context);

        return axis === null ? null : RotateGesture.begin({
          ray: context.ray,
          axis,
          origin: context.origin,
          eye: context.eye,
          radius: context.size
        });
      }
      case "scale":
        return ScaleGesture.begin(context, target.scale);
      default:
        return TranslateGesture.begin(
          context,
          target.getWorldPosition(kWorldPosition)
        );
    }
  }

  #applyDrag(
    session: TransformSession,
    event: PointerEvent
  ): void {
    if (!this.#updateRay(event)) {
      return;
    }
    if (session.target.parent !== session.parent) {
      this.#drag.end();

      return;
    }
    if (!this.#applyGesture(session, !event.altKey)) {
      return;
    }

    const { target } = session;
    if (
      target.position.equals(session.lastPosition) &&
      target.quaternion.equals(session.lastQuaternion) &&
      target.scale.equals(session.lastScale)
    ) {
      return;
    }

    session.lastPosition.copy(target.position);
    session.lastQuaternion.copy(target.quaternion);
    session.lastScale.copy(target.scale);
    session.changed = true;
    this.#updateGizmo();
    this.dispatchEvent({
      type: "change",
      ...this.#gestureEvent(session),
      changed: true
    });
  }

  #applyGesture(
    session: TransformSession,
    snapping: boolean
  ): boolean {
    const { gesture, target } = session;
    const { ray } = this.#raycaster;
    const snap = this.#snap;

    if (gesture.mode === "translate") {
      const step = snapping ? snap.translate : null;
      const grid = step === null ? null : snap.grid;
      if (!gesture.update(ray, step, kDelta, grid)) {
        return false;
      }

      kWorldPosition.copy(session.startWorldPosition).add(kDelta);
      this.#moveTo(session, kWorldPosition);
      if (this.limits !== null) {
        this.limits.clampPoint(target.position, target.position);
      }

      return true;
    }

    if (gesture.mode === "rotate") {
      const angle = gesture.update(ray, snapping ? snap.rotate : null);
      if (angle === null) {
        return false;
      }

      kRotation.setFromAxisAngle(gesture.axis, angle);
      target.quaternion
        .copy(session.parentWorldQuaternion)
        .invert()
        .multiply(kRotation)
        .multiply(session.parentWorldQuaternion)
        .multiply(session.startQuaternion);
      this.#moveAboutPivot(
        session,
        (offset) => offset.applyQuaternion(kRotation)
      );

      return true;
    }

    if (!gesture.update(ray, snapping ? snap.scale : null, kFactor)) {
      return false;
    }

    target.scale.copy(session.startScale).multiply(kFactor);
    kFrameInverse.copy(session.frameQuaternion).invert();
    this.#moveAboutPivot(
      session,
      (offset) => offset
        .applyQuaternion(kFrameInverse)
        .multiply(kFactor)
        .applyQuaternion(session.frameQuaternion)
    );

    return true;
  }

  #moveAboutPivot(
    session: TransformSession,
    transform: (offset: THREE.Vector3) => THREE.Vector3
  ): void {
    kOffset.subVectors(session.startWorldPosition, session.origin);
    if (kOffset.lengthSq() < kPivotEpsilon) {
      session.target.position.copy(session.startPosition);

      return;
    }

    kWorldPosition.copy(session.origin).add(transform(kOffset));
    this.#moveTo(session, kWorldPosition);
  }

  #moveTo(
    session: TransformSession,
    worldPosition: THREE.Vector3
  ): void {
    const { target, parent } = session;

    target.position.copy(worldPosition);
    if (parent !== null) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(target.position);
    }
  }

  #finishSession(
    session: TransformSession,
    release: PointerDragRelease
  ): void {
    this.#gizmo.activate(null);
    this.dispatchEvent({
      type: "end",
      ...this.#gestureEvent(session),
      changed: session.changed,
      cancelled: release.cancelled
    });
  }

  #pick(
    event: PointerEvent
  ): TransformHandle | null {
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
    if (!this.#drag.toNdc(event, kPointer)) {
      return false;
    }

    this.#raycaster.setFromCamera(kPointer, this.object);

    return true;
  }

  #updateGizmo(): void {
    this.#gizmo.parent?.updateWorldMatrix(true, false);
    this.#gizmo.updateMatrixWorld(true);
  }

  #gestureEvent(
    session: TransformSession
  ): TransformGestureEvent {
    const { target } = session;
    target.updateWorldMatrix(true, false);

    return {
      mode: session.gesture.mode,
      handle: { ...session.handle },
      position: target.position.clone(),
      quaternion: target.quaternion.clone(),
      scale: target.scale.clone(),
      worldPosition: target.getWorldPosition(new THREE.Vector3())
    };
  }
}

function resolveTranslateSnap(
  snap: SnapStep
): number | THREE.Vector3 | null {
  if (snap === null) {
    return null;
  }
  if (typeof snap === "number") {
    return positive(snap, "snap.translate");
  }

  return new THREE.Vector3(
    positive(snap.x, "snap.translate.x"),
    positive(snap.y, "snap.translate.y"),
    positive(snap.z, "snap.translate.z")
  );
}

function resolveGrid(
  grid: number | THREE.Vector3Like | null
): THREE.Vector3 | null {
  if (grid === null) {
    return null;
  }
  if (typeof grid === "number") {
    return new THREE.Vector3().setScalar(finite(grid, "snap.grid"));
  }

  return new THREE.Vector3(
    finite(grid.x, "snap.grid.x"),
    finite(grid.y, "snap.grid.y"),
    finite(grid.z, "snap.grid.z")
  );
}
