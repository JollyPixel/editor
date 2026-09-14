// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kPivotMarkerSize = 0.025;
const kPivotMarkerTextureSize = 64;
const kPivotColor = 0xffcc00;
const kPivotRenderOrder = Infinity;

export default class PivotMarker {
  #sprite: THREE.Sprite;

  constructor() {
    this.#sprite = this.#create();
  }

  public get object(): THREE.Object3D {
    return this.#sprite;
  }

  public setVisible(visible: boolean): void {
    this.#sprite.visible = visible;
  }

  public dispose(): void {
    if (this.#sprite.material instanceof THREE.SpriteMaterial) {
      this.#sprite.material.map?.dispose();
      this.#sprite.material.dispose();
    }
  }

  #create(): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: this.#circleTexture(kPivotMarkerTextureSize),
      color: kPivotColor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: false,
      toneMapped: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.name = "pivot_visual";
    sprite.visible = false;
    sprite.renderOrder = kPivotRenderOrder;
    sprite.frustumCulled = false;
    sprite.scale.setScalar(kPivotMarkerSize);

    return sprite;
  }

  #circleTexture(size: number): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }
}
