// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { MaterialSurfaceJSON } from "@jolly-pixel/asset.voxel-model/client";

export function paintBlockSurface(
  target: THREE.MeshStandardNodeMaterial,
  surface: MaterialSurfaceJSON,
  lit: boolean
): void {
  target.color.set(surface.color);
  target.opacity = surface.opacity;
  target.roughness = surface.roughness;
  target.metalness = surface.metalness;
  target.emissive.set(surface.emissive);
  target.emissiveIntensity = surface.emissiveIntensity;
  if (target.lights !== lit) {
    target.lights = lit;
    target.needsUpdate = true;
  }
}
