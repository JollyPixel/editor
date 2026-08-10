// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kLabelCanvasWidth = 384;
const kLabelCanvasHeight = 96;
const kLabelWorldWidth = 1.6;
const kLabelWorldHeight = kLabelWorldWidth * (kLabelCanvasHeight / kLabelCanvasWidth);
const kLabelOffsetY = 0.45;

export interface PeerFrustumLabelOptions {
  /**
   * Display name for the connected peer.
   */
  name: string;
  /**
   * Text/border color. Matches the owning `PeerFrustum`'s wireframe color.
   */
  color: THREE.ColorRepresentation;
  /**
   * Draws the nameplate on a rounded, semi-transparent background box
   * (bordered with `color`) instead of the default shadow-only text.
   * @default false
   */
  showNameBox?: boolean;
}

/**
 * Floating nameplate for a `PeerFrustum`, rendered as a billboard
 * `THREE.Sprite` with a canvas-generated texture. Positioned just above the
 * frustum's local origin so it reads as a label attached to the peer.
 */
export class PeerFrustumLabel extends THREE.Sprite {
  #name: string;
  #color: THREE.ColorRepresentation;
  #showNameBox: boolean;
  #canvas: HTMLCanvasElement;
  #texture: THREE.CanvasTexture;

  constructor(
    options: PeerFrustumLabelOptions
  ) {
    const { name, color, showNameBox = false } = options;

    const canvas = document.createElement("canvas");
    canvas.width = kLabelCanvasWidth;
    canvas.height = kLabelCanvasHeight;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    super(new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true
    }));

    this.#name = name;
    this.#color = color;
    this.#showNameBox = showNameBox;
    this.#canvas = canvas;
    this.#texture = texture;

    this.scale.set(kLabelWorldWidth, kLabelWorldHeight, 1);
    this.position.set(0, kLabelOffsetY, 0);
    this.renderOrder = 1;

    this.#draw();
  }

  setName(
    name: string
  ): void {
    this.#name = name;
    this.#draw();
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#color = color;
    this.#draw();
  }

  setShowNameBox(
    showNameBox: boolean
  ): void {
    this.#showNameBox = showNameBox;
    this.#draw();
  }

  dispose(): void {
    this.#texture.dispose();
    this.material.dispose();
  }

  #draw(): void {
    const context = this.#canvas.getContext("2d")!;
    const { width, height } = this.#canvas;
    const colorStyle = new THREE.Color(this.#color).getStyle();

    context.clearRect(0, 0, width, height);

    if (this.#showNameBox) {
      context.fillStyle = "rgba(20, 20, 20, 0.75)";
      context.strokeStyle = colorStyle;
      context.lineWidth = 6;
      context.beginPath();
      context.roundRect(3, 3, width - 6, height - 6, height / 2);
      context.fill();
      context.stroke();

      context.fillStyle = "#ffffff";
    }
    else {
      // No background box — a dark drop shadow keeps the colored text legible
      // against any scene background instead.
      context.shadowColor = "rgba(0, 0, 0, 0.9)";
      context.shadowBlur = 6;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 2;

      context.fillStyle = colorStyle;
    }

    context.font = "700 60px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(this.#name, width / 2, height / 2);

    context.shadowColor = "transparent";

    this.#texture.needsUpdate = true;
  }
}
