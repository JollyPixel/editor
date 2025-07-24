// Import Third-party Dependencies
import {
  Systems,
  Actor
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { OrbitCameraControls } from "./components/OrbitCamera.js";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Systems.Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;
gameInstance.threeScene.background = null;
gameInstance.setRatio(16 / 9);

new Actor(gameInstance, { name: "camera" })
  .registerComponent(OrbitCameraControls);

const mesh = new THREE.Mesh(
  createGeometry(16),
  new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load("textures/cube.png"),
    side: THREE.DoubleSide
  })
);
gameInstance.threeScene.add(new THREE.AmbientLight(new THREE.Color("#ffffff"), 3));
gameInstance.threeScene.add(mesh);

runtime.start();

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
      -halfSize, nextY, z,      // 0: gauche arrière
      halfSize, nextY, z,       // 1: droite arrière
      halfSize, nextY, nextZ,   // 2: droite avant
      -halfSize, nextY, nextZ   // 3: gauche avant
    );

    // UVs pour la face horizontale
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    // Indices pour la face horizontale (2 triangles)
    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2,
      vertexIndex, vertexIndex + 2, vertexIndex + 3
    );
    vertexIndex += 4;

    // Face verticale de la marche (contremarche)
    if (step < stepCount - 1) {
      vertices.push(
        -halfSize, y, nextZ,      // 0: gauche bas
        halfSize, y, nextZ,       // 1: droite bas
        halfSize, nextY, nextZ,   // 2: droite haut
        -halfSize, nextY, nextZ   // 3: gauche haut
      );

      // UVs pour la face verticale
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

      // Indices pour la face verticale (2 triangles)
      indices.push(
        vertexIndex, vertexIndex + 2, vertexIndex + 1,
        vertexIndex, vertexIndex + 3, vertexIndex + 2
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
      -halfSize, y, z,          // 0: arrière bas
      -halfSize, y, nextZ,      // 1: avant bas
      -halfSize, nextY, nextZ,  // 2: avant haut
      -halfSize, nextY, z       // 3: arrière haut
    );

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2,
      vertexIndex, vertexIndex + 2, vertexIndex + 3
    );
    vertexIndex += 4;

    // Face latérale droite
    vertices.push(
      halfSize, y, z,           // 0: arrière bas
      halfSize, nextY, z,       // 1: arrière haut
      halfSize, nextY, nextZ,   // 2: avant haut
      halfSize, y, nextZ        // 3: avant bas
    );

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2,
      vertexIndex, vertexIndex + 2, vertexIndex + 3
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
