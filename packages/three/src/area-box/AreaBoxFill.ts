// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { Vector3Like } from "../types.ts";

// CONSTANTS
// BoxGeometry group order: +X, -X, +Y, -Y, +Z, -Z.
const kFaceShading = [0.74, 0.54, 1, 0.36, 0.88, 0.45];
const kBoxFaceCount = 6;
const kVerticesPerFace = 4;

const kSmokeColor = new THREE.Color("#080b11");
const kFillSmoke = 0.45;

// Render after the camera-following grid so opacity controls its blend.
const kRenderOrder = 1;

export interface AreaBoxFillOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  shadeFaces: boolean;
}

/**
 * Translucent unit box scaled to the area extent, and its raycast target.
 */
export class AreaBoxFill extends THREE.Mesh<
  THREE.BoxGeometry,
  THREE.MeshBasicMaterial
> {
  #opacity: number;
  #color: THREE.Color;
  #smokedColor: THREE.Color;

  constructor(
    options: AreaBoxFillOptions
  ) {
    const { color, opacity, shadeFaces } = options;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    if (shadeFaces) {
      applyFaceShading(geometry);
    }

    const areaColor = new THREE.Color(color);
    const smokedColor = areaColor.clone().lerp(
      kSmokeColor,
      kFillSmoke
    );

    super(
      geometry,
      new THREE.MeshBasicMaterial({
        color: smokedColor,
        vertexColors: shadeFaces,
        transparent: true,
        opacity,
        depthWrite: true,
        side: THREE.FrontSide
      })
    );

    this.#opacity = opacity;
    this.#color = areaColor;
    this.#smokedColor = smokedColor;
    this.renderOrder = kRenderOrder;
  }

  resize(
    size: Vector3Like
  ): void {
    const { x, y, z } = size;

    this.scale.set(x, y, z);
    this.position.set(
      x / 2,
      y / 2,
      z / 2
    );
  }

  emphasize(
    opacity: number,
    tint: number
  ): void {
    this.material.opacity = Math.min(
      this.#opacity * opacity,
      1
    );
    this.material.color.copy(this.#smokedColor).lerp(
      this.#color,
      tint
    );
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function applyFaceShading(
  geometry: THREE.BoxGeometry
): void {
  const vertexCount = kBoxFaceCount * kVerticesPerFace;
  const colors = new Float32Array(vertexCount * 3);

  for (let face = 0; face < kBoxFaceCount; face++) {
    const brightness = kFaceShading[face];
    for (let vertex = 0; vertex < kVerticesPerFace; vertex++) {
      const offset = ((face * kVerticesPerFace) + vertex) * 3;
      colors[offset] = brightness;
      colors[offset + 1] = brightness;
      colors[offset + 2] = brightness;
    }
  }

  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(colors, 3)
  );
}
