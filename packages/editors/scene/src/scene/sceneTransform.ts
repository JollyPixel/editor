// Import Third-party Dependencies
import * as THREE from "three";
import type {
  SceneActorPlacement,
  SceneTransformJSON,
  SceneTreeReader,
  Vector3JSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";

// CONSTANTS
const kPrecision = 1e6;
const kUnitScale = {
  x: 1,
  y: 1,
  z: 1
};

type TransformTree = Pick<SceneTreeReader, "peekActor" | "ancestorIds">;
type AnchorPoses = Pick<Systems.SceneAnchorsReader, "findAnchor">;

export function rebaseTransform(
  tree: TransformTree,
  anchors: AnchorPoses,
  id: string,
  placement: SceneActorPlacement
): SceneTransformJSON {
  const pose = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3()
  };
  worldMatrix(tree, anchors, placement.parentId)
    .multiply(placementMatrix(anchors, placement))
    .invert()
    .multiply(worldMatrix(tree, anchors, id))
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
  anchors: AnchorPoses,
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
      matrix
        .premultiply(Systems.composeSceneTransform(actor.transform, local))
        .premultiply(placementMatrix(anchors, actor));
    }
  }

  return matrix;
}

function placementMatrix(
  anchors: AnchorPoses,
  placement: SceneActorPlacement
): THREE.Matrix4 {
  const { parentId, anchor } = placement;
  const pose = parentId === null || anchor === undefined ?
    undefined :
    anchors.findAnchor(parentId, anchor)?.pose;

  return pose === undefined ?
    new THREE.Matrix4() :
    Systems.composeSceneTransform({ ...pose, scale: kUnitScale }, new THREE.Matrix4());
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
