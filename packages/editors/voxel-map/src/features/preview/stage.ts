// Import Third-party Dependencies
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Import Internal Dependencies
import { SceneLighting } from "../../scene/environment/SceneLighting.ts";

// CONSTANTS
const kCameraFov = 45;
const kCameraZ = 2.2;
const kFitFactor = 0.78;
const kEnvironmentBlur = 0.04;
const kEnvironmentIntensity = 0.6;

export const PREVIEW_FIT_RADIUS = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;
export const PREVIEW_TILT = 0.4;
export const PREVIEW_ROTATION_STEP = 0.005;
export const PREVIEW_STILL_ROTATION = Math.PI / 4;

export interface PreviewStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createPreviewStage(): PreviewStage {
  const scene = new THREE.Scene();
  scene.add(...new SceneLighting().lights);

  const camera = new THREE.PerspectiveCamera(kCameraFov, 1, 0.1, 20);
  camera.position.set(0, 0, kCameraZ);

  return {
    scene,
    camera
  };
}

export function lightWithEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): void {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  scene.environment = generator.fromScene(room, kEnvironmentBlur).texture;
  scene.environmentIntensity = kEnvironmentIntensity;
  generator.dispose();
  room.dispose();
}

export function needsEnvironment(
  mesh: THREE.Mesh
): boolean {
  const materials = Array.isArray(mesh.material) ?
    mesh.material :
    [mesh.material];

  return materials.some(
    (material) => material instanceof THREE.MeshStandardMaterial
  );
}

export function fitGeometry(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || sphere.radius <= 0) {
    return;
  }

  const { center, radius } = sphere;
  const scale = PREVIEW_FIT_RADIUS / radius;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
}
