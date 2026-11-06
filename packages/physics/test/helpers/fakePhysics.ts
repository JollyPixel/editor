// Import Internal Dependencies
import type {
  BodyDesc,
  BodyKind,
  ColliderDesc,
  ContactEvent,
  ContactListener,
  PhysicsBackend,
  PhysicsBody,
  PhysicsCollider,
  PhysicsWorld,
  PhysicsWorldOptions,
  QuaternionLike,
  Ray,
  RayHit,
  Vector3Like
} from "#src/index.ts";

export type PhysicsCall =
  | { type: "step"; seconds: number; }
  | { type: "moveTo"; body: FakeBody; position: Vector3Like; };

export class FakeCollider implements PhysicsCollider {
  readonly body: FakeBody;
  readonly desc: ColliderDesc;
  readonly sensor: boolean;
  attached = true;

  constructor(
    body: FakeBody,
    desc: ColliderDesc
  ) {
    this.body = body;
    this.desc = desc;
    this.sensor = desc.sensor ?? false;
  }

  detach(): void {
    this.attached = false;
  }
}

export class FakeBody implements PhysicsBody {
  readonly kind: BodyKind;
  readonly desc: BodyDesc;
  readonly colliders: FakeCollider[] = [];
  removed = false;

  #position: Vector3Like;
  #rotation: QuaternionLike;
  #linearVelocity = { x: 0, y: 0, z: 0 };
  #angularVelocity = { x: 0, y: 0, z: 0 };
  #calls: PhysicsCall[];

  constructor(
    desc: BodyDesc,
    calls: PhysicsCall[]
  ) {
    this.kind = desc.kind;
    this.desc = desc;
    this.#position = { ...desc.position ?? { x: 0, y: 0, z: 0 } };
    this.#rotation = { ...desc.rotation ?? { x: 0, y: 0, z: 0, w: 1 } };
    this.#calls = calls;
  }

  get position(): Vector3Like {
    this.#alive();

    return { ...this.#position };
  }

  set position(
    value: Vector3Like
  ) {
    this.#position = { ...value };
  }

  get rotation(): QuaternionLike {
    this.#alive();

    return { ...this.#rotation };
  }

  get linearVelocity(): Vector3Like {
    this.#alive();

    return { ...this.#linearVelocity };
  }

  set linearVelocity(
    value: Vector3Like
  ) {
    this.#alive();
    this.#linearVelocity = { ...value };
  }

  get angularVelocity(): Vector3Like {
    this.#alive();

    return { ...this.#angularVelocity };
  }

  set angularVelocity(
    value: Vector3Like
  ) {
    this.#alive();
    this.#angularVelocity = { ...value };
  }

  teleport(
    position: Vector3Like,
    rotation?: QuaternionLike
  ): void {
    this.#alive();
    this.#position = { ...position };
    if (rotation !== undefined) {
      this.#rotation = { ...rotation };
    }
  }

  moveTo(
    position: Vector3Like
  ): void {
    this.#alive();
    this.#calls.push({
      type: "moveTo",
      body: this,
      position: { ...position }
    });
  }

  applyImpulse(): void {
    this.#alive();
  }

  applyForce(): void {
    this.#alive();
  }

  attach(
    desc: ColliderDesc
  ): FakeCollider {
    this.#alive();
    const collider = new FakeCollider(this, desc);
    this.colliders.push(collider);

    return collider;
  }

  remove(): void {
    this.removed = true;
  }

  #alive(): void {
    if (this.removed) {
      throw new Error("The physics body was removed.");
    }
  }
}

export class FakePhysicsWorld implements PhysicsWorld {
  gravity = { x: 0, y: -9.81, z: 0 };
  readonly bodies: FakeBody[] = [];
  readonly calls: PhysicsCall[] = [];
  pendingContacts: ContactEvent[] = [];
  nextHit: RayHit | null = null;
  onStep: () => void = () => undefined;
  disposed = false;

  get liveBodies(): FakeBody[] {
    return this.bodies.filter((body) => !body.removed);
  }

  createBody(
    desc: BodyDesc
  ): FakeBody {
    this.#alive();
    const body = new FakeBody(desc, this.calls);
    this.bodies.push(body);

    return body;
  }

  step(
    seconds: number
  ): void {
    this.#alive();
    this.calls.push({ type: "step", seconds });
    this.onStep();
  }

  drainContacts(
    listener: ContactListener
  ): void {
    for (const event of this.pendingContacts.splice(0)) {
      listener(event);
    }
  }

  castRay(
    _ray: Ray
  ): RayHit | null {
    return this.nextHit;
  }

  dispose(): void {
    this.disposed = true;
  }

  #alive(): void {
    if (this.disposed) {
      throw new Error("The physics world was disposed.");
    }
  }
}

export class FakePhysicsBackend implements PhysicsBackend {
  readonly name = "fake";
  readonly worlds: FakePhysicsWorld[] = [];

  createWorld(
    options: PhysicsWorldOptions = {}
  ): FakePhysicsWorld {
    const world = new FakePhysicsWorld();
    if (options.gravity !== undefined) {
      world.gravity = { ...options.gravity };
    }
    this.worlds.push(world);

    return world;
  }
}
