// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { CanvasSprite } from "../../common/CanvasSprite.ts";

// CONSTANTS
const kLabelCanvasWidth = 384;
const kLabelCanvasHeight = 96;
const kLabelWorldWidth = 2;
const kRenderOrder = 10;
const kDefaultColor = "#ffffff";
const kOutlineColor = "rgba(10, 12, 16, 0.95)";
const kOutlineWidth = 9;

export interface AreaBoxLabelOptions {
  displayName: string;
  color?: THREE.ColorRepresentation;
}

export class AreaBoxLabel extends CanvasSprite {
  #displayName: string;
  #color: THREE.ColorRepresentation;

  constructor(
    options: AreaBoxLabelOptions
  ) {
    const { displayName, color = kDefaultColor } = options;

    super({
      width: kLabelCanvasWidth,
      height: kLabelCanvasHeight,
      worldWidth: kLabelWorldWidth,
      renderOrder: kRenderOrder
    });

    this.#displayName = displayName;
    this.#color = color;
    this.redraw();
  }

  get displayName(): string {
    return this.#displayName;
  }

  set displayName(
    displayName: string
  ) {
    this.#displayName = displayName;
    this.redraw();
  }

  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color = color;
    this.redraw();
  }

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
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
  }
}
