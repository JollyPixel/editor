// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { MaterialSurfaceJSON } from "@jolly-pixel/asset.voxel-model/client";

export function paintBlockSurface(
  target: THREE.MeshStandardNodeMaterial,
  surface: MaterialSurfaceJSON
): void {
  target.color.set(surface.color);
  target.opacity = surface.opacity;
  target.roughness = surface.roughness;
  target.metalness = surface.metalness;
  target.emissive.set(surface.emissive);
  target.emissiveIntensity = surface.emissiveIntensity;
}

export function paintBlockMaterial(
  target: THREE.MeshStandardNodeMaterial,
  surface: MaterialSurfaceJSON
): void {
  const transparent = surface.opacity < 1;
  if (target.transparent !== transparent) {
    target.transparent = transparent;
    target.depthWrite = !transparent;
    target.needsUpdate = true;
  }
  paintBlockSurface(target, surface);
}
