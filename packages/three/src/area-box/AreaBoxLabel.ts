// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Canvas2D,
  createCanvas2D
} from "../common/Canvas2D.ts";

// CONSTANTS
const kLabelCanvasWidth = 384;
const kLabelCanvasHeight = 96;
const kLabelWorldWidth = 2;
const kLabelWorldHeight = kLabelWorldWidth *
  (kLabelCanvasHeight / kLabelCanvasWidth);
const kDefaultColor = "#ffffff";
const kOutlineColor = "rgba(10, 12, 16, 0.95)";
const kOutlineWidth = 9;

export interface AreaBoxLabelOptions {
  displayName: string;
  color?: THREE.ColorRepresentation;
}

export class AreaBoxLabel extends THREE.Sprite {
  #displayName: string;
  #color: THREE.ColorRepresentation;
  #canvas: Canvas2D;
  #texture: THREE.CanvasTexture;
  #disposed = false;

  constructor(
    options: AreaBoxLabelOptions
  ) {
    const { displayName, color = kDefaultColor } = options;

    const canvas = createCanvas2D(
      kLabelCanvasWidth,
      kLabelCanvasHeight
    );

    const texture = new THREE.CanvasTexture(canvas.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    super(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true
      })
    );

    this.#displayName = displayName;
    this.#color = color;
    this.#canvas = canvas;
    this.#texture = texture;

    this.scale.set(
      kLabelWorldWidth,
      kLabelWorldHeight,
      1
    );
    this.renderOrder = 10;

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

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#texture.dispose();
    this.material.dispose();
  }

  #draw(): void {
    const { context, canvas } = this.#canvas;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);

    context.font = "700 56px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.shadowColor = "rgba(0, 0, 0, 0.85)";
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 1;
    context.lineJoin = "round";
    context.lineWidth = kOutlineWidth;
    context.strokeStyle = kOutlineColor;
    context.strokeText(this.#displayName, width / 2, height / 2);

    context.shadowColor = "transparent";
    context.fillStyle = new THREE.Color(this.#color).getStyle();
    context.fillText(this.#displayName, width / 2, height / 2);

    this.#texture.needsUpdate = true;
  }
}
