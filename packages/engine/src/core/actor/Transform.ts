// Import Internal Dependencies
import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type QuaternionLike,
  type Vector3Like
} from "../math.ts";
import {
  DETACHED_ACTOR_NODE,
  type ActorNode
} from "../systems/scene/SceneGraph.ts";

// CONSTANTS
const kMatrix = new Matrix4();
const kFrame = new Matrix4();
const kWorld = new Matrix4();
const kTarget = new Vector3();
const kUp = new Vector3();
const kDefaultUp = new Vector3(0, 1, 0);
const kOffset = new Vector3();
const kOther = new Vector3();
const kParentOrientation = new Quaternion();
const kRotation = new Quaternion();
const kEulerRotation = new Quaternion();
const kPosition = new Vector3();
const kScale = new Vector3();
const kDirection = new Vector3();
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

  constructor(
    node: ActorNode = DETACHED_ACTOR_NODE
  ) {
    this.#node = node;
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
      return this.setGlobalMatrix(kWorld);
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

  getVisible() {
    return this.#visible;
  }

  setVisible(
    visible: boolean
  ) {
    this.#visible = visible;
    this.#node.show(visible);

    return this;
  }

  get visibleInHierarchy(): boolean {
    return this.#visible && (this.#parent?.visibleInHierarchy ?? true);
  }

  getGlobalMatrix(
    matrix: Matrix4 = new Matrix4()
  ) {
    return matrix.copy(this.#worldMatrix());
  }

  getGlobalPosition(
    position: Vector3 = new Vector3()
  ) {
    return position.setFromMatrixPosition(this.#worldMatrix());
  }

  getGlobalOrientation(
    orientation: Quaternion = new Quaternion()
  ) {
    this.#worldMatrix().decompose(kPosition, orientation, kScale);

    return orientation;
  }

  getGlobalEulerAngles(
    angles: Euler = new Euler()
  ) {
    return angles.setFromQuaternion(
      this.getGlobalOrientation(kOrientation)
    );
  }

  getLocalPosition(
    position: Vector3 = new Vector3()
  ) {
    return position.copy(this.#position);
  }

  getLocalOrientation(
    orientation: Quaternion = new Quaternion()
  ) {
    return orientation.copy(this.#quaternion);
  }

  getLocalEulerAngles(
    angles: Euler = new Euler()
  ) {
    return angles.setFromQuaternion(this.#quaternion);
  }

  getLocalScale(
    scale: Vector3 = new Vector3()
  ) {
    return scale.copy(this.#scale);
  }

  getParentGlobalOrientation(
    orientation: Quaternion = new Quaternion()
  ) {
    if (this.#parent === null && this.#socket === null) {
      return orientation.identity();
    }

    this.#parentFrame(kFrame).decompose(kPosition, orientation, kScale);

    return orientation;
  }

  place(
    position: Vector3Like,
    quaternion: QuaternionLike,
    scale: Vector3Like
  ) {
    this.#position.copy(position);
    this.#quaternion.copy(quaternion);
    this.#scale.copy(scale);

    return this.#changed();
  }

  setGlobalMatrix(
    matrix: Readonly<Matrix4>
  ) {
    kMatrix.multiplyMatrices(
      this.#parentFrame(kFrame).invert(),
      matrix
    );
    kMatrix.decompose(this.#position, this.#quaternion, this.#scale);

    return this.#changed();
  }

  setGlobalPosition(
    pos: Vector3Like
  ) {
    this.#position
      .copy(pos)
      .applyMatrix4(this.#parentFrame(kFrame).invert());

    return this.#changed();
  }

  setLocalPosition(
    pos: Vector3Like
  ) {
    this.#position.copy(pos);

    return this.#changed();
  }

  lookAt(
    target: TransformLike | Vector3Like,
    up?: Vector3Like
  ) {
    const targetVec = target instanceof Transform || "transform" in target
      ? Transform.resolveTransform(target).getGlobalPosition(kTarget)
      : kTarget.copy(target);
    const upVec = up ?
      kUp.copy(up) :
      kDefaultUp;
    kMatrix.lookAt(
      this.getGlobalPosition(kPosition),
      targetVec,
      upVec
    );
    this.setGlobalOrientation(kOrientation.setFromRotationMatrix(kMatrix));

    return this;
  }

  lookTowards(
    direction: Vector3Like,
    up?: Vector3Like
  ) {
    this.lookAt(
      this.getGlobalPosition(kPosition).sub(direction),
      up
    );

    return this;
  }

  setLocalOrientation(
    quaternion: QuaternionLike
  ) {
    this.#quaternion.copy(quaternion);

    return this.#changed();
  }

  setGlobalOrientation(
    quaternion: QuaternionLike
  ) {
    this.#quaternion.multiplyQuaternions(
      this.getParentGlobalOrientation(kParentOrientation).invert(),
      kTargetOrientation.copy(quaternion)
    );

    return this.#changed();
  }

  setLocalEulerAngles(
    eulerAngles: Euler
  ) {
    this.#quaternion.setFromEuler(eulerAngles);

    return this.#changed();
  }

  setGlobalEulerAngles(
    eulerAngles: Euler
  ) {
    return this.setGlobalOrientation(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  setLocalScale(
    scale: Vector3Like
  ) {
    this.#scale.copy(scale);

    return this.#changed();
  }

  rotateGlobal(
    quaternion: QuaternionLike
  ) {
    const rotation = kRotation
      .copy(quaternion)
      .multiply(this.getGlobalOrientation(kOrientation));
    this.setGlobalOrientation(rotation);

    return this;
  }

  rotateLocal(
    quaternion: QuaternionLike
  ) {
    this.#quaternion.premultiply(
      kTargetOrientation.copy(quaternion)
    );

    return this.#changed();
  }

  rotateGlobalEulerAngles(
    eulerAngles: Euler
  ) {
    return this.rotateGlobal(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  rotateLocalEulerAngles(
    eulerAngles: Euler
  ) {
    return this.rotateLocal(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  moveGlobal(
    offset: Vector3Like
  ) {
    this.setGlobalPosition(
      this.getGlobalPosition(kPosition).add(offset)
    );

    return this;
  }

  moveLocal(
    offset: Vector3Like
  ) {
    this.#position.add(offset);

    return this.#changed();
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

  getForward(
    target: Vector3 = new Vector3()
  ) {
    return target
      .set(0, 0, -1)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  getRight(
    target: Vector3 = new Vector3()
  ) {
    return target
      .set(1, 0, 0)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  getUp(
    target: Vector3 = new Vector3()
  ) {
    return target
      .set(0, 1, 0)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  moveForward(
    distance: number
  ) {
    return this.moveGlobal(
      this.getForward(kDirection).multiplyScalar(distance)
    );
  }

  moveRight(
    distance: number
  ) {
    return this.moveGlobal(
      this.getRight(kDirection).multiplyScalar(distance)
    );
  }

  moveUp(
    distance: number
  ) {
    return this.moveGlobal(
      this.getUp(kDirection).multiplyScalar(distance)
    );
  }

  distanceTo(
    other: TransformLike
  ) {
    const otherPos = Transform
      .resolveTransform(other)
      .getGlobalPosition(kOther);

    return this.getGlobalPosition(kPosition).distanceTo(otherPos);
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
