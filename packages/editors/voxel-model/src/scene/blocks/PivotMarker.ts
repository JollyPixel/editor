// Import Third-party Dependencies
import * as THREE from "three";
import { createCanvas2D } from "@jolly-pixel/three";

// Import Internal Dependencies
import { RenderOrder } from "../renderOrder.ts";

// CONSTANTS
const kPivotMarkerSize = 0.025;
const kPivotMarkerTextureSize = 64;
const kPosition = new THREE.Vector3();
const kQuaternion = new THREE.Quaternion();
const kScale = new THREE.Vector3();
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
    this.object.renderOrder = RenderOrder.pivotMarker;
    this.object.frustumCulled = false;
    this.object.scale.setScalar(kPivotMarkerSize);
    this.object.onBeforeRender = () => {
      this.object.matrixWorld
        .decompose(kPosition, kQuaternion, kScale)
        .compose(kPosition, kQuaternion, kScale.setScalar(kPivotMarkerSize));
    };
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
  const { canvas, context } = createCanvas2D(size, size);

  context.beginPath();
  context.arc(size / 2, size / 2, (size / 2) - 1, 0, Math.PI * 2);
  context.fillStyle = "white";
  context.fill();

  return new THREE.CanvasTexture(canvas);
}
