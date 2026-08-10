// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type Canvas2D, createCanvas2D } from "../common/Canvas2D.ts";

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
  displayName: string;
  /**
   * Text and border color.
   */
  color: THREE.ColorRepresentation;
  /**
   * Draw the name on a rounded background with a `color` border.
   * @default false
   */
  showNameBox?: boolean;
}

/**
 * Billboard nameplate rendered with a canvas texture.
 * Positioned above the owning frustum's local origin.
 */
export class PeerFrustumLabel extends THREE.Sprite {
  #displayName: string;
  #color: THREE.ColorRepresentation;
  #showNameBox: boolean;
  #canvas: Canvas2D;
  #texture: THREE.CanvasTexture;

  constructor(
    options: PeerFrustumLabelOptions
  ) {
    const {
      displayName,
      color,
      showNameBox = false
    } = options;

    const canvas = createCanvas2D(
      kLabelCanvasWidth,
      kLabelCanvasHeight
    );

    const texture = new THREE.CanvasTexture(
      canvas.canvas
    );
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });
    super(material);

    this.#displayName = displayName;
    this.#color = color;
    this.#showNameBox = showNameBox;
    this.#canvas = canvas;
    this.#texture = texture;

    this.scale.set(
      kLabelWorldWidth,
      kLabelWorldHeight,
      1
    );
    this.position.set(
      0,
      kLabelOffsetY,
      0
    );
    this.renderOrder = 1;

    this.#draw();
  }

  get displayName(): string {
    return this.#displayName;
  }

  set displayName(
    displayName: string
  ) {
    this.#displayName = displayName;
    this.#draw();
  }

  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color = color;
    this.#draw();
  }

  get showNameBox(): boolean {
    return this.#showNameBox;
  }

  set showNameBox(
    showNameBox: boolean
  ) {
    this.#showNameBox = showNameBox;
    this.#draw();
  }

  dispose(): void {
    this.#texture.dispose();
    this.material.dispose();
  }

  #draw(): void {
    const { context, canvas } = this.#canvas;
    const { width, height } = canvas;

    const colorStyle = new THREE.Color(
      this.#color
    ).getStyle();

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
      // Use a dark shadow when no background is drawn.
      context.shadowColor = "rgba(0, 0, 0, 0.9)";
      context.shadowBlur = 6;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 2;

      context.fillStyle = colorStyle;
    }

    context.font = "700 60px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(this.#displayName, width / 2, height / 2);

    context.shadowColor = "transparent";

    this.#texture.needsUpdate = true;
  }
}
