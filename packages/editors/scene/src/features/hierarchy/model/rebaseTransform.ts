// Import Third-party Dependencies
import * as THREE from "three";
import type {
  SceneTransformJSON,
  SceneTreeReader,
  Vector3JSON
} from "@jolly-pixel/asset.scene/client";

// CONSTANTS
const kPrecision = 1e6;

type TransformTree = Pick<SceneTreeReader, "peekActor" | "ancestorIds">;

export function rebaseTransform(
  tree: TransformTree,
  id: string,
  parentId: string | null
): SceneTransformJSON {
  const local = worldMatrix(tree, parentId)
    .invert()
    .multiply(worldMatrix(tree, id));

  return decompose(local);
}

function worldMatrix(
  tree: TransformTree,
  id: string | null
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  if (id === null) {
    return matrix;
  }

  for (const actorId of [id, ...tree.ancestorIds(id)]) {
    const actor = tree.peekActor(actorId);
    if (actor !== undefined) {
      matrix.premultiply(localMatrix(actor.transform));
    }
  }

  return matrix;
}

function localMatrix(
  transform: SceneTransformJSON
): THREE.Matrix4 {
  const { position, rotation, scale } = transform;

  return new THREE.Matrix4().compose(
    new THREE.Vector3(position.x, position.y, position.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z)
    )),
    new THREE.Vector3(scale.x, scale.y, scale.z)
  );
}

export function decompose(
  matrix: THREE.Matrix4
): SceneTransformJSON {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion);

  return {
    position: rounded(position),
    rotation: rounded({
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z)
    }),
    scale: rounded(scale)
  };
}

function rounded(
  vector: THREE.Vector3Like
): Vector3JSON {
  return {
    x: round(vector.x),
    y: round(vector.y),
    z: round(vector.z)
  };
}

function round(
  value: number
): number {
  return (Math.round(value * kPrecision) / kPrecision) + 0;
}
