// Import Third-party Dependencies
import * as THREE from "three";
import { projectToClient } from "@jolly-pixel/three";

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ViewSnapshot {
  projection: number[];
  world: number[];
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export function clientPointOf(
  view: ViewSnapshot,
  point: THREE.Vector3Like
): ScreenPoint {
  const camera = new THREE.Camera();
  camera.projectionMatrix.fromArray(view.projection);
  new THREE.Matrix4()
    .fromArray(view.world)
    .decompose(camera.position, camera.quaternion, camera.scale);

  const client = projectToClient(
    camera,
    { getBoundingClientRect: () => view.bounds },
    point
  );
  if (client === null) {
    throw new Error("The point is outside the camera depth range.");
  }

  return client;
}
