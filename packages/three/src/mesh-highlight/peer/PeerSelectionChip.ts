// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { CanvasSprite } from "../../common/CanvasSprite.ts";

// CONSTANTS
const kChipCanvasSize = 64;
const kChipWorldSize = 0.3;
const kChipRadius = kChipCanvasSize * 0.4;
const kChipStrokeWidth = kChipCanvasSize * 0.08;
const kChipLabelFont = `700 ${kChipCanvasSize * 0.36}px sans-serif`;
const kRenderOrder = 1;

export interface PeerSelectionChipOptions {
  color: THREE.ColorRepresentation;
  /**
   * Optional centered label, such as `"+3"`.
   */
  label?: string;
}

export class PeerSelectionChip extends CanvasSprite {
  #color: THREE.ColorRepresentation;
  #label: string | undefined;

  constructor(
    options: PeerSelectionChipOptions
  ) {
    super({
      width: kChipCanvasSize,
      height: kChipCanvasSize,
      worldWidth: kChipWorldSize,
      renderOrder: kRenderOrder
    });

    this.#color = options.color;
    this.#label = options.label;
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

  get label(): string | undefined {
    return this.#label;
  }

  set label(
    label: string | undefined
  ) {
    this.#label = label;
    this.redraw();
  }

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number
  ): void {
    const center = width / 2;

    context.beginPath();
    context.arc(center, center, kChipRadius, 0, Math.PI * 2);
    context.fillStyle = new THREE.Color(this.#color).getStyle();
    context.fill();

    context.lineWidth = kChipStrokeWidth;
    context.strokeStyle = "rgba(20, 20, 20, 0.85)";
    context.stroke();

    if (this.#label !== undefined) {
      context.font = kChipLabelFont;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#ffffff";
      context.fillText(this.#label, center, center);
    }
  }
}
