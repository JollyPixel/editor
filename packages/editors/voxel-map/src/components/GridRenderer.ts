// Import Third-party Dependencies
import * as THREE from "three";
import { ActorComponent, Actor } from "@jolly-pixel/engine";

interface GridRendererOptions {
  size?: number;
  direction?: number;
  ratio: number;
}

export class GridRenderer extends ActorComponent {
  size: number;
  direction: number;
  ratio: number;

  mesh: THREE.LineSegments | null;

  constructor(
    actor: Actor,
    options?: GridRendererOptions
  ) {
    super({ actor, typeName: "GridRenderer" });
    options && this.setGrid(options);
  }

  setIsLayerActive(
    active: boolean
  ) {
    if (this.mesh !== null) {
      this.mesh.visible = active;
    }
  }

  setGrid(
    options: GridRendererOptions
  ) {
    const { size = 50, direction = 1, ratio } = options;
    this.clearMesh();

    this.size = size;
    this.direction = direction;
    this.ratio = ratio;

    this.createMesh();
  }

  resize(
    value: number
  ) {
    this.size = value;
    this.clearMesh();
    this.createMesh();
  }

  setRatio(
    ratio: number
  ) {
    this.ratio = ratio;
    this.clearMesh();
    this.createMesh();
  }

  createMesh() {
    const size = this.ratio * this.size;

    const positions: number[] = [];
    for (let i = -size; i <= size; i += this.ratio) {
      // lignes parallèles à X
      positions.push(-size, 0, i, size, 0, i);
      // lignes parallèles à Z
      positions.push(i, 0, -size, i, 0, size);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color("#000000"),
      opacity: 0.2,
      transparent: true
    });

    this.mesh = new THREE.LineSegments(geometry, material);
    this.mesh.computeLineDistances();

    this.actor.object3D.add(this.mesh);
  }

  clearMesh() {
    if (!this.mesh) {
      return;
    }

    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((material) => material.dispose());
    }
    else {
      this.mesh.material.dispose();
    }
    this.actor.object3D.remove(this.mesh);
    this.mesh = null;
  }

  override destroy() {
    this.clearMesh();
    super.destroy();
  }
}
