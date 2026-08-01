/**
 * Structural subset of the Rapier3D API used by this plugin. Declaring it
 * structurally keeps the WASM module out of the package: the consumer passes an
 * already-initialised Rapier namespace, which satisfies these shapes uncast.
 */

export interface RapierColliderDesc {
  setTranslation(
    x: number,
    y: number,
    z: number
  ): this;
}

export interface RapierRigidBodyDesc {
  setTranslation(
    x: number,
    y: number,
    z: number
  ): this;
}

export interface RapierRigidBody {
  readonly handle: number;
}

export interface RapierCollider {
  readonly handle: number;
}

export interface RapierWorld {
  createRigidBody(
    desc: RapierRigidBodyDesc
  ): RapierRigidBody;
  createCollider(
    desc: RapierColliderDesc,
    parent?: RapierRigidBody
  ): RapierCollider;
  removeCollider(
    collider: RapierCollider,
    wakeUp: boolean
  ): void;
  removeRigidBody(
    body: RapierRigidBody
  ): void;
}

/** The subset of the Rapier module's static API required by this plugin. */
export interface RapierAPI {
  RigidBodyDesc: {
    fixed(): RapierRigidBodyDesc;
  };
  ColliderDesc: {
    cuboid(
      hx: number,
      hy: number,
      hz: number
    ): RapierColliderDesc;
    trimesh(
      vertices: Float32Array,
      indices: Uint32Array
    ): RapierColliderDesc;
  };
}
