// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// CONSTANTS
const kInstanceSpacing = 2.6;

export class InstanceGrid {
  readonly mesh: THREE.InstancedMesh;

  #count = 0;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
  }

  get count(): number {
    return this.#count;
  }

  spawn(
    count: number
  ): void {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      matrix.setPosition(this.positionOf(i, count));
      this.mesh.setMatrixAt(i, matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = count;
    this.mesh.computeBoundingSphere();
    this.#count = count;
  }

  positionOf(
    index: number,
    count = this.#count
  ): THREE.Vector3 {
    const side = Math.ceil(Math.cbrt(count));
    const centerOffset = ((side - 1) * kInstanceSpacing) / 2;

    return new THREE.Vector3(
      ((index % side) * kInstanceSpacing) - centerOffset,
      ((Math.floor(index / side) % side) * kInstanceSpacing) - centerOffset,
      (Math.floor(index / (side * side)) * kInstanceSpacing) - centerOffset
    );
  }

  proxyMesh(
    instanceId: number
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.mesh.geometry);
    mesh.matrixAutoUpdate = false;
    this.mesh.getMatrixAt(instanceId, mesh.matrix);
    mesh.updateMatrixWorld(true);

    return mesh;
  }

  randomIds(
    pickCount: number
  ): number[] {
    const pool = Array.from({ length: this.#count }, (_, index) => index);
    const wanted = Math.min(Math.max(pickCount, 0), pool.length);

    for (let i = 0; i < wanted; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, wanted);
  }

  nearestIds(
    origin: THREE.Vector3,
    want: number,
    excludeId: number | null = null
  ): number[] {
    const distances: { id: number; distanceSquared: number; }[] = [];
    for (let i = 0; i < this.#count; i++) {
      if (i === excludeId) {
        continue;
      }
      distances.push({
        id: i,
        distanceSquared: this.positionOf(i).distanceToSquared(origin)
      });
    }
    distances.sort((a, b) => a.distanceSquared - b.distanceSquared);

    return distances.slice(0, Math.max(want, 0)).map(({ id }) => id);
  }
}
