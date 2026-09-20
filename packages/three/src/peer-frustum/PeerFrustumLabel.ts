// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { CanvasSprite } from "../common/CanvasSprite.ts";

// CONSTANTS
const kLabelCanvasWidth = 384;
const kLabelCanvasHeight = 96;
const kLabelWorldWidth = 1.6;
const kLabelOffsetY = 0.45;
const kRenderOrder = 1;

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
export class PeerFrustumLabel extends CanvasSprite {
  #displayName: string;
  #color: THREE.ColorRepresentation;
  #showNameBox: boolean;

  constructor(
    options: PeerFrustumLabelOptions
  ) {
    const {
      displayName,
      color,
      showNameBox = false
    } = options;

    super({
      width: kLabelCanvasWidth,
      height: kLabelCanvasHeight,
      worldWidth: kLabelWorldWidth,
      renderOrder: kRenderOrder
    });

    this.#displayName = displayName;
    this.#color = color;
    this.#showNameBox = showNameBox;
    this.position.set(
      0,
      kLabelOffsetY,
      0
    );

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

  get opacity(): number {
    return this.material.opacity;
  }

  set opacity(
    opacity: number
  ) {
    this.material.opacity = Math.min(1, Math.max(0, opacity));
  }

  get showNameBox(): boolean {
    return this.#showNameBox;
  }

  set showNameBox(
    showNameBox: boolean
  ) {
    this.#showNameBox = showNameBox;
    this.redraw();
  }

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const colorStyle = new THREE.Color(
      this.#color
    ).getStyle();

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
  }
}
