// Import Internal Dependencies
import {
  mat4,
  quat,
  vec3,
  loadQuaternion,
  loadVector3,
  lookRotation,
  type Mat4,
  type QuaternionLike,
  type Vec3,
  type Vector3Like
} from "../../math.ts";
import {
  DETACHED_ACTOR_NODE,
  type ActorNode
} from "../../systems/scene/SceneGraph.ts";
import { LocalSpace } from "./LocalSpace.ts";
import { GlobalSpace } from "./GlobalSpace.ts";
import type { TransformPose } from "./TransformPose.ts";
import {
  moveInWorld,
  orientInWorld,
  placeInWorld,
  worldDirection,
  worldPosition,
  type WorldAxis
} from "./worldPose.ts";

// CONSTANTS
const kWorld = mat4.create();
const kEye = vec3.create();
const kTarget = vec3.create();
const kUp = vec3.create();
const kDefaultUp = vec3.fromValues(0, 1, 0);
const kOffset = vec3.create();
const kOrientation = quat.create();
const kTargetOrientation = quat.create();

export type TransformLike = Transform | { transform: Transform; };

export interface TransformSocket {
  readonly matrix: Mat4;
}

export class Transform {
  static resolveTransform(
    value: TransformLike
  ): Transform {
    return value instanceof Transform ? value : value.transform;
  }

  #node: ActorNode;
  #pose: TransformPose;
  #parent: Transform | null = null;
  #children = new Set<Transform>();
  #socket: TransformSocket | null = null;
  #position = vec3.create();
  #quaternion = quat.create();
  #scale = vec3.fromValues(1, 1, 1);
  #visible = true;
  #local = mat4.create();
  #localDirty = false;
  #world = mat4.create();
  #worldDirty = false;

  readonly local: LocalSpace;
  readonly global: GlobalSpace;

  constructor(
    node: ActorNode = DETACHED_ACTOR_NODE
  ) {
    this.#node = node;

    this.#pose = {
      position: this.#position,
      quaternion: this.#quaternion,
      scale: this.#scale,
      changed: () => this.#changed(),
      globalMatrix: () => this.#worldMatrix(),
      parentFrame: (target) => this.#parentFrame(target)
    };
    this.local = new LocalSpace(this.#pose);
    this.global = new GlobalSpace(this.#pose);
  }

  get parent(): Transform | null {
    return this.#parent;
  }

  get socket(): TransformSocket | null {
    return this.#socket;
  }

  attach(
    parent: Transform | null,
    keepWorld = false
  ): this {
    if (keepWorld) {
      mat4.copy(kWorld, this.#worldMatrix());
    }

    this.#unlink();
    this.#parent = parent;
    if (this.#socket !== null) {
      this.#socket = null;
      this.#node.seat(null);
    }
    if (parent === null) {
      this.#node.attach(null);
    }
    else {
      parent.#children.add(this);
      this.#node.attach(parent.#node);
    }

    if (keepWorld) {
      placeInWorld(this.#pose, kWorld);

      return this;
    }

    return this.#changed();
  }

  seat(
    socket: TransformSocket | null
  ): this {
    this.#socket = socket;
    this.#node.seat(socket?.matrix ?? null);

    return this.#changed();
  }

  detach(): void {
    this.#unlink();
    this.#parent = null;
    this.#socket = null;
    this.#localDirty = true;
    this.#invalidate();
  }

  get visible(): boolean {
    return this.#visible;
  }

  set visible(
    visible: boolean
  ) {
    this.#visible = visible;
    this.#node.show(visible);
  }

  get visibleInHierarchy(): boolean {
    return this.#visible && (this.#parent?.visibleInHierarchy ?? true);
  }

  lookAt(
    target: TransformLike | Readonly<Vector3Like>,
    up?: Readonly<Vector3Like>
  ) {
    const targetPosition = target instanceof Transform || "transform" in target ?
      worldPosition(Transform.resolveTransform(target).#pose, kTarget) :
      loadVector3(kTarget, target);

    return this.#lookAt(targetPosition, up);
  }

  lookTowards(
    direction: Readonly<Vector3Like>,
    up?: Readonly<Vector3Like>
  ) {
    vec3.subtract(
      kTarget,
      worldPosition(this.#pose, kTarget),
      loadVector3(kOffset, direction)
    );

    return this.#lookAt(kTarget, up);
  }

  moveOriented(
    offset: Readonly<Vector3Like>
  ) {
    vec3.transformQuat(kOffset, loadVector3(kOffset, offset), this.#quaternion);
    vec3.add(this.#position, this.#position, kOffset);

    return this.#changed();
  }

  moveForward(
    distance: number
  ) {
    return this.#moveAlong("forward", distance);
  }

  moveRight(
    distance: number
  ) {
    return this.#moveAlong("right", distance);
  }

  moveUp(
    distance: number
  ) {
    return this.#moveAlong("up", distance);
  }

  distanceTo(
    other: TransformLike
  ) {
    return vec3.distance(
      worldPosition(this.#pose, kEye),
      worldPosition(Transform.resolveTransform(other).#pose, kTarget)
    );
  }

  lerpPosition(
    target: Readonly<Vector3Like>,
    alpha: number
  ) {
    vec3.lerp(this.#position, this.#position, loadVector3(kTarget, target), alpha);

    return this.#changed();
  }

  slerpOrientation(
    target: Readonly<QuaternionLike>,
    alpha: number
  ) {
    quat.slerp(
      this.#quaternion,
      this.#quaternion,
      loadQuaternion(kTargetOrientation, target),
      alpha
    );

    return this.#changed();
  }

  #lookAt(
    target: Vec3,
    up?: Readonly<Vector3Like>
  ): this {
    lookRotation(
      kOrientation,
      worldPosition(this.#pose, kEye),
      target,
      up ? loadVector3(kUp, up) : kDefaultUp
    );
    orientInWorld(this.#pose, kOrientation);

    return this;
  }

  #moveAlong(
    axis: WorldAxis,
    distance: number
  ): this {
    const direction = worldDirection(this.#pose, kOffset, axis);
    moveInWorld(this.#pose, vec3.scale(direction, direction, distance));

    return this;
  }

  #unlink(): void {
    if (this.#parent !== null) {
      this.#parent.#children.delete(this);
    }
  }

  #parentFrame(
    target: Mat4
  ): Mat4 {
    if (this.#parent === null) {
      mat4.identity(target);
    }
    else {
      mat4.copy(target, this.#parent.#worldMatrix());
    }
    if (this.#socket !== null) {
      mat4.multiply(target, target, this.#socket.matrix);
    }

    return target;
  }

  #localMatrix(): Mat4 {
    if (this.#localDirty) {
      mat4.fromRotationTranslationScale(
        this.#local,
        this.#quaternion,
        this.#position,
        this.#scale
      );
      if (this.#socket !== null) {
        mat4.multiply(this.#local, this.#socket.matrix, this.#local);
      }
      this.#localDirty = false;
    }

    return this.#local;
  }

  #worldMatrix(): Mat4 {
    if (this.#worldDirty) {
      if (this.#parent === null) {
        mat4.copy(this.#world, this.#localMatrix());
      }
      else {
        mat4.multiply(
          this.#world,
          this.#parent.#worldMatrix(),
          this.#localMatrix()
        );
      }
      this.#worldDirty = false;
    }

    return this.#world;
  }

  #changed(): this {
    this.#localDirty = true;
    this.#invalidate();
    this.#node.place(this.#position, this.#quaternion, this.#scale);

    return this;
  }

  #invalidate(): void {
    if (this.#worldDirty) {
      return;
    }

    this.#worldDirty = true;
    for (const child of this.#children) {
      child.#invalidate();
    }
  }
}
