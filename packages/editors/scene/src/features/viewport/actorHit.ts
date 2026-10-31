// Import Third-party Dependencies
import * as THREE from "three";
import { isVisibleInHierarchy } from "@jolly-pixel/engine";

// CONSTANTS
const kPivotMaxDistance = 100;
const kPivotFallbackDistance = 10;
const kGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export interface ActorResolver {
  findActorId(object: THREE.Object3D): string | null;
}

export interface ActorHit {
  id: string;
  point: THREE.Vector3;
  distance: number;
}

export function castActor(
  aimed: THREE.Raycaster,
  scene: THREE.Object3D,
  targets: ActorResolver
): ActorHit | null {
  for (const hit of aimed.intersectObjects(scene.children, true)) {
    const id = isVisibleInHierarchy(hit.object) ?
      targets.findActorId(hit.object) :
      null;
    if (id !== null) {
      return {
        id,
        point: hit.point,
        distance: hit.distance
      };
    }
  }

  return null;
}

export function pivotPoint(
  aimed: THREE.Raycaster,
  scene: THREE.Object3D,
  targets: ActorResolver
): THREE.Vector3 {
  const hit = castActor(aimed, scene, targets);
  if (hit !== null && hit.distance <= kPivotMaxDistance) {
    return hit.point;
  }

  const { ray } = aimed;
  const ground = ray.intersectPlane(kGroundPlane, new THREE.Vector3());
  if (ground !== null && ground.distanceTo(ray.origin) <= kPivotMaxDistance) {
    return ground;
  }

  return ray.at(kPivotFallbackDistance, new THREE.Vector3());
}
