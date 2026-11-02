// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { MeshSurfaceSettings } from "./MeshSurface.ts";

export class SurfaceMesh {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

  constructor(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: MeshSurfaceSettings
  ) {
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    this.configure(surface);
    parent.add(this.mesh);
  }

  replaceGeometry(
    geometry: THREE.BufferGeometry
  ): void {
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }

  configure(
    surface: MeshSurfaceSettings
  ): void {
    const { material: settings, castShadow, receiveShadow } = surface;
    const material = this.mesh.material;

    material.color.set(settings.color);
    material.roughness = settings.roughness;
    material.metalness = settings.metalness;
    material.emissive.set(settings.emissive);
    material.emissiveIntensity = settings.emissiveIntensity;
    material.opacity = settings.opacity;

    const transparent = settings.opacity < 1;
    if (
      transparent !== material.transparent ||
      settings.flatShading !== material.flatShading
    ) {
      material.transparent = transparent;
      material.flatShading = settings.flatShading;
      material.needsUpdate = true;
    }

    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = receiveShadow;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
