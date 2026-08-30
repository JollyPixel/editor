/**
 * Structural Rapier3D subset that keeps the WASM module consumer-owned.
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
