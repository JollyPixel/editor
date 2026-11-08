// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { MeshSurfaceSettings } from "./MeshSurface.ts";

export class SurfaceMesh<TMaterial extends THREE.Material = THREE.Material> {
  static standard(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: MeshSurfaceSettings
  ): SurfaceMesh<THREE.MeshStandardMaterial> {
    const material = new THREE.MeshStandardMaterial();

    return new SurfaceMesh(parent, geometry, surface, material, material);
  }

  static shaded(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: MeshSurfaceSettings,
    material: THREE.Material
  ): SurfaceMesh {
    return new SurfaceMesh(parent, geometry, surface, material, null);
  }

  readonly mesh: THREE.Mesh<THREE.BufferGeometry, TMaterial>;

  #styled: THREE.MeshStandardMaterial | null;

  constructor(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: MeshSurfaceSettings,
    material: TMaterial,
    styled: THREE.MeshStandardMaterial | null
  ) {
    this.#styled = styled;
    this.mesh = new THREE.Mesh(geometry, material);
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
    if (this.#styled !== null) {
      styleMaterial(this.#styled, surface.material);
    }
    this.mesh.castShadow = surface.castShadow;
    this.mesh.receiveShadow = surface.receiveShadow;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function styleMaterial(
  material: THREE.MeshStandardMaterial,
  settings: MeshSurfaceSettings["material"]
): void {
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
}
