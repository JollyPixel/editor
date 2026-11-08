// Import Internal Dependencies
import {
  Matrix4,
  Quaternion,
  Vector3,
  type QuaternionLike,
  type Vector3Like
} from "../../math.ts";
import {
  DETACHED_ACTOR_NODE,
  type ActorNode
} from "../../systems/scene/SceneGraph.ts";
import { LocalSpace } from "./LocalSpace.ts";
import { GlobalSpace } from "./GlobalSpace.ts";
import type { TransformPose } from "./TransformPose.ts";

// CONSTANTS
const kMatrix = new Matrix4();
const kWorld = new Matrix4();
const kTarget = new Vector3();
const kUp = new Vector3();
const kDefaultUp = new Vector3(0, 1, 0);
const kOffset = new Vector3();
const kOrientation = new Quaternion();
const kTargetOrientation = new Quaternion();

export type TransformLike = Transform | { transform: Transform; };

export interface TransformSocket {
  readonly matrix: Readonly<Matrix4>;
}

export class Transform {
  static resolveTransform(
    value: TransformLike
  ): Transform {
    return value instanceof Transform ? value : value.transform;
  }

  #node: ActorNode;
  #parent: Transform | null = null;
  #children = new Set<Transform>();
  #socket: TransformSocket | null = null;
  #position = new Vector3();
  #quaternion = new Quaternion();
  #scale = new Vector3(1, 1, 1);
  #visible = true;
  #local = new Matrix4();
  #localDirty = false;
  #world = new Matrix4();
  #worldDirty = false;

  readonly local: LocalSpace;
  readonly global: GlobalSpace;

  constructor(
    node: ActorNode = DETACHED_ACTOR_NODE
  ) {
    this.#node = node;

    const pose: TransformPose = {
      position: this.#position,
      quaternion: this.#quaternion,
      scale: this.#scale,
      changed: () => this.#changed(),
      globalMatrix: () => this.#worldMatrix(),
      parentFrame: (target) => this.#parentFrame(target)
    };
    this.local = new LocalSpace(pose);
    this.global = new GlobalSpace(pose);
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
      kWorld.copy(this.#worldMatrix());
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
      this.global.matrix = kWorld;

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
    target: TransformLike | Vector3Like,
    up?: Vector3Like
  ) {
    const targetVec = target instanceof Transform || "transform" in target
      ? kTarget.copy(Transform.resolveTransform(target).global.position)
      : kTarget.copy(target);
    const upVec = up ?
      kUp.copy(up) :
      kDefaultUp;
    kMatrix.lookAt(
      this.global.position,
      targetVec,
      upVec
    );
    this.global.orientation = kOrientation.setFromRotationMatrix(kMatrix);

    return this;
  }

  lookTowards(
    direction: Vector3Like,
    up?: Vector3Like
  ) {
    return this.lookAt(
      kOffset.copy(this.global.position).sub(direction),
      up
    );
  }

  moveOriented(
    offset: Vector3Like
  ) {
    const orientedOffset = kOffset
      .copy(offset)
      .applyQuaternion(this.#quaternion);
    this.#position.add(orientedOffset);

    return this.#changed();
  }

  moveForward(
    distance: number
  ) {
    return this.#moveAlong(this.global.forward, distance);
  }

  moveRight(
    distance: number
  ) {
    return this.#moveAlong(this.global.right, distance);
  }

  moveUp(
    distance: number
  ) {
    return this.#moveAlong(this.global.up, distance);
  }

  distanceTo(
    other: TransformLike
  ) {
    return this.global.position.distanceTo(
      Transform.resolveTransform(other).global.position
    );
  }

  lerpPosition(
    target: Vector3Like,
    alpha: number
  ) {
    this.#position.lerp(target, alpha);

    return this.#changed();
  }

  slerpOrientation(
    target: QuaternionLike,
    alpha: number
  ) {
    this.#quaternion.slerp(kTargetOrientation.copy(target), alpha);

    return this.#changed();
  }

  #moveAlong(
    direction: Readonly<Vector3>,
    distance: number
  ): this {
    this.global.move(kOffset.copy(direction).multiplyScalar(distance));

    return this;
  }

  #unlink(): void {
    if (this.#parent !== null) {
      this.#parent.#children.delete(this);
    }
  }

  #parentFrame(
    target: Matrix4
  ): Matrix4 {
    if (this.#parent === null) {
      target.identity();
    }
    else {
      target.copy(this.#parent.#worldMatrix());
    }
    if (this.#socket !== null) {
      target.multiply(this.#socket.matrix);
    }

    return target;
  }

  #localMatrix(): Matrix4 {
    if (this.#localDirty) {
      this.#local.compose(this.#position, this.#quaternion, this.#scale);
      if (this.#socket !== null) {
        this.#local.premultiply(this.#socket.matrix);
      }
      this.#localDirty = false;
    }

    return this.#local;
  }

  #worldMatrix(): Matrix4 {
    if (this.#worldDirty) {
      if (this.#parent === null) {
        this.#world.copy(this.#localMatrix());
      }
      else {
        this.#world.multiplyMatrices(
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
