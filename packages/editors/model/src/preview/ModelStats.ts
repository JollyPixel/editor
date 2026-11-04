// Import Third-party Dependencies
import type { Model } from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

export class ModelStats {
  readonly meshes: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly materials: number;
  readonly bones: number;
  readonly clips: number;

  constructor(
    model: Model
  ) {
    let meshes = 0;
    let vertices = 0;
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    const bones = new Set<THREE.Bone>();

    model.object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const geometry: THREE.BufferGeometry = child.geometry;
      const positions = geometry.getAttribute("position");
      meshes++;
      vertices += positions?.count ?? 0;
      triangles += Math.floor((geometry.index?.count ?? positions?.count ?? 0) / 3);
      for (const material of [child.material].flat()) {
        materials.add(material);
      }
      if (child instanceof THREE.SkinnedMesh) {
        for (const bone of child.skeleton.bones) {
          bones.add(bone);
        }
      }
    });

    this.meshes = meshes;
    this.vertices = vertices;
    this.triangles = triangles;
    this.materials = materials.size;
    this.bones = bones.size;
    this.clips = model.animations.length;
  }
}
