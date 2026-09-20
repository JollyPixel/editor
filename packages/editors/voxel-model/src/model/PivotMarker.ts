// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kPivotMarkerSize = 0.025;
const kPivotMarkerTextureSize = 64;
const kPivotRenderOrder = Infinity;
export const NEUTRAL_HIGHLIGHT_COLOR = 0xcccccc;

export class PivotMarker {
  readonly object: THREE.Sprite;

  #owners = new Map<string, THREE.ColorRepresentation>();

  constructor() {
    const material = new THREE.SpriteMaterial({
      map: circleTexture(kPivotMarkerTextureSize),
      color: NEUTRAL_HIGHLIGHT_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: false,
      toneMapped: false
    });

    this.object = new THREE.Sprite(material);
    this.object.name = "pivot_visual";
    this.object.visible = false;
    this.object.renderOrder = kPivotRenderOrder;
    this.object.frustumCulled = false;
    this.object.scale.setScalar(kPivotMarkerSize);
  }

  isShownBy(
    owner: string
  ): boolean {
    return this.#owners.has(owner);
  }

  show(
    owner: string,
    color: THREE.ColorRepresentation = NEUTRAL_HIGHLIGHT_COLOR
  ): void {
    this.#owners.set(owner, color);
    this.#sync();
  }

  hide(
    owner: string
  ): void {
    this.#owners.delete(owner);
    this.#sync();
  }

  dispose(): void {
    this.object.material.map?.dispose();
    this.object.material.dispose();
  }

  #sync(): void {
    this.object.visible = this.#owners.size > 0;
    this.object.material.color.set(
      [...this.#owners.values()].at(-1) ?? NEUTRAL_HIGHLIGHT_COLOR
    );
  }
}

function circleTexture(
  size: number
): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("PivotMarker: 2D canvas context is unavailable.");
  }

  context.beginPath();
  context.arc(size / 2, size / 2, (size / 2) - 1, 0, Math.PI * 2);
  context.fillStyle = "white";
  context.fill();

  return new THREE.CanvasTexture(canvas);
}
