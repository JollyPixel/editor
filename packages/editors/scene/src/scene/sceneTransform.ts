// Import Third-party Dependencies
import * as THREE from "three";
import type {
  SceneTransformJSON,
  SceneTreeReader,
  Vector3JSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";

// CONSTANTS
const kPrecision = 1e6;

type TransformTree = Pick<SceneTreeReader, "peekActor" | "ancestorIds">;

export interface TransformPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export function rebaseTransform(
  tree: TransformTree,
  id: string,
  parentId: string | null
): SceneTransformJSON {
  const object = new THREE.Object3D();
  worldMatrix(tree, parentId)
    .invert()
    .multiply(worldMatrix(tree, id))
    .decompose(object.position, object.quaternion, object.scale);

  return roundedTransform(object);
}

export function decomposePose(
  pose: TransformPose
): SceneTransformJSON {
  const object = new THREE.Object3D();
  object.position.copy(pose.position);
  object.quaternion.copy(pose.quaternion);
  object.scale.copy(pose.scale);

  return roundedTransform(object);
}

function worldMatrix(
  tree: TransformTree,
  id: string | null
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  if (id === null) {
    return matrix;
  }

  const object = new THREE.Object3D();
  for (const actorId of [id, ...tree.ancestorIds(id)]) {
    const actor = tree.peekActor(actorId);
    if (actor !== undefined) {
      Systems.writeSceneTransform(object, actor.transform);
      matrix.premultiply(object.matrix);
    }
  }

  return matrix;
}

function roundedTransform(
  object: THREE.Object3D
): SceneTransformJSON {
  const { position, rotation, scale } = Systems.readSceneTransform(object);

  return {
    position: rounded(position),
    rotation: rounded(rotation),
    scale: rounded(scale)
  };
}

function rounded(
  vector: Vector3JSON
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
