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

export function rebaseTransform(
  tree: TransformTree,
  id: string,
  parentId: string | null
): SceneTransformJSON {
  const pose = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3()
  };
  worldMatrix(tree, parentId)
    .invert()
    .multiply(worldMatrix(tree, id))
    .decompose(pose.position, pose.quaternion, pose.scale);

  return decomposePose(pose);
}

export function decomposePose(
  pose: Systems.SceneTransformPose
): SceneTransformJSON {
  const { position, rotation, scale } = Systems.readSceneTransform(pose);

  return {
    position: rounded(position),
    rotation: rounded(rotation),
    scale: rounded(scale)
  };
}

function worldMatrix(
  tree: TransformTree,
  id: string | null
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  if (id === null) {
    return matrix;
  }

  const local = new THREE.Matrix4();
  for (const actorId of [id, ...tree.ancestorIds(id)]) {
    const actor = tree.peekActor(actorId);
    if (actor !== undefined) {
      matrix.premultiply(Systems.composeSceneTransform(actor.transform, local));
    }
  }

  return matrix;
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
