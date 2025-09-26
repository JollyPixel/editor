// Import Third-party Dependencies
import {
  Actor
} from "@jolly-pixel/engine";
import { Player, loadPlayer } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { OrbitCameraControls } from "./components/OrbitCamera.js";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Player(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;
const scene = gameInstance.scene.getSource();
scene.background = null;
gameInstance.renderer.setRatio(16 / 9);

new Actor(gameInstance, { name: "camera" })
  .registerComponent(OrbitCameraControls);

const mesh = new THREE.Mesh(
  createGeometry(16),
  new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load("textures/cube.png"),
    side: THREE.DoubleSide
  })
);
scene.add(new THREE.AmbientLight(new THREE.Color("#ffffff"), 3));
scene.add(mesh);

loadPlayer(runtime)
  .catch(console.error);

function createGeometry(size: number): THREE.BufferGeometry {
  const halfSize = size / 2;
  const stepCount = 2;
  const stepHeight = size / stepCount;
  const stepDepth = size / stepCount;

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  let vertexIndex = 0;

  // Créer chaque marche de l'escalier
  for (let step = 0; step < stepCount; step++) {
    const y = -halfSize + (step * stepHeight);
    const z = -halfSize + (step * stepDepth);
    const nextY = y + stepHeight;
    const nextZ = z + stepDepth;

    // Face horizontale de la marche (dessus)
    vertices.push(
      -halfSize, nextY, z, halfSize, nextY, z, halfSize, nextY, nextZ, -halfSize, nextY, nextZ
    );

    // UVs pour la face horizontale
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Indices pour la face horizontale (2 triangles)
    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3
    );
    vertexIndex += 4;

    // Face verticale de la marche (contremarche)
    if (step < stepCount - 1) {
      vertices.push(
        -halfSize, y, nextZ, halfSize, y, nextZ, halfSize, nextY, nextZ, -halfSize, nextY, nextZ
      );

      // UVs pour la face verticale
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

      // Indices pour la face verticale (2 triangles)
      indices.push(
        vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex, vertexIndex + 3, vertexIndex + 2
      );
      vertexIndex += 4;
    }
  }

  // Faces latérales gauche et droite
  for (let step = 0; step < stepCount; step++) {
    const y = -halfSize + (step * stepHeight);
    const z = -halfSize + (step * stepDepth);
    const nextY = y + stepHeight;
    const nextZ = z + stepDepth;

    // Face latérale gauche
    vertices.push(
      -halfSize, y, z, -halfSize, y, nextZ, -halfSize, nextY, nextZ, -halfSize, nextY, z
    );

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3
    );
    vertexIndex += 4;

    // Face latérale droite
    vertices.push(
      halfSize, y, z, halfSize, nextY, z, halfSize, nextY, nextZ, halfSize, y, nextZ
    );

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3
    );
    vertexIndex += 4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
