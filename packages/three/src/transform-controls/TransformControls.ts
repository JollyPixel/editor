// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { eyeDirection } from "../common/eyeDirection.ts";
import { PointerDrag } from "../common/PointerDrag.ts";
import type { SnapStep } from "../common/snap.ts";
import { RotateGesture } from "./gestures/RotateGesture.ts";
import { ScaleGesture } from "./gestures/ScaleGesture.ts";
import { TranslateGesture } from "./gestures/TranslateGesture.ts";
import type { GestureContext } from "./gestures/GestureContext.ts";
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
  optionalStep,
  positive
} from "./validation.ts";

// CONSTANTS
const kModes: readonly TransformMode[] = ["translate", "rotate", "scale"];
const kPivotEpsilon = 1e-12;
const kCancelKey = "Escape";

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
  cancelled: boolean;
}

export class TransformControls extends THREE.Controls<
  TransformControlsEventMap,
  THREE.Camera
> {
  readonly helper: THREE.Object3D;

  limits: THREE.Box3 | null;

  #drag: PointerDrag;
  #frame = new TransformFrame();
  #gizmo: TransformGizmo;
  #target: THREE.Object3D | null = null;
  #snap: ResolvedSnap = {
    translate: null,
    rotate: null,
    scale: null
  };
  #raycaster = new THREE.Raycaster();
  #session: TransformSession | null = null;
  #keyTarget: Document | null = null;

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
    this.#drag = new PointerDrag({
      press: (event) => this.#claim(event),
      hover: (event) => this.#hover(event),
      drag: (event) => this.#applyDrag(event),
      release: () => this.#finishSession()
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
    return this.#session !== null;
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
    const { translate, rotate, scale } = this.#snap;

    return {
      translate: translate instanceof THREE.Vector3
        ? translate.clone()
        : translate,
      rotate,
      scale
    };
  }

  set snap(
    snap: TransformSnapOptions
  ) {
    this.#snap = {
      translate: resolveTranslateSnap(snap.translate ?? null),
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
    const session = this.#session;
    if (session === null) {
      return;
    }

    session.cancelled = true;
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
    this.#drag.end();
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
  ): boolean {
    if (!this.enabled || this.#target === null) {
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
  ): void {
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
      return;
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
      changed: false,
      cancelled: false
    };
    this.#session = session;
    this.#gizmo.hover(null);
    this.#gizmo.activate(handle);
    this.#drag.begin(event);
    this.#listenForCancel();

    this.dispatchEvent({
      type: "start",
      ...this.#gestureEvent(session)
    });
  }

  #beginGesture(
    context: GestureContext,
    target: THREE.Object3D
  ): TransformGesture | null {
    switch (this.#gizmo.mode) {
      case "rotate":
        return RotateGesture.begin(context);
      case "scale":
        return ScaleGesture.begin(context, target.scale);
      default:
        return TranslateGesture.begin(context);
    }
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
      if (!gesture.update(ray, step, kDelta)) {
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

  #finishSession(): void {
    const session = this.#session;
    if (session === null) {
      return;
    }

    this.#session = null;
    this.#stopListeningForCancel();
    this.#gizmo.activate(null);
    this.dispatchEvent({
      type: "end",
      ...this.#gestureEvent(session),
      changed: session.changed,
      cancelled: session.cancelled
    });
  }

  #listenForCancel(): void {
    const keyTarget = this.#drag.element?.ownerDocument ?? null;
    this.#keyTarget = keyTarget;
    keyTarget?.addEventListener("keydown", this.#onKeyDown);
  }

  #stopListeningForCancel(): void {
    this.#keyTarget?.removeEventListener("keydown", this.#onKeyDown);
    this.#keyTarget = null;
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

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === kCancelKey) {
      this.cancel();
    }
  };
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
