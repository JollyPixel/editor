// Import Internal Dependencies
import {
  type Axis,
  AXIS_COLOR,
  HANDLE_HIGHLIGHT_COLOR
} from "../../common/axes.ts";
import { CanvasSprite } from "../../common/CanvasSprite.ts";

// CONSTANTS
const kCanvasSize = 96;
const kRenderOrder = 21;
const kBackground = "rgba(8, 11, 17, 0.88)";

export class BoxFlipChip extends CanvasSprite {
  readonly axis: Axis;

  #highlighted = false;

  constructor(
    axis: Axis
  ) {
    super({
      width: kCanvasSize,
      height: kCanvasSize,
      worldWidth: 1,
      renderOrder: kRenderOrder
    });

    this.axis = axis;
    this.name = `box-handle-flip-${axis}`;
    this.redraw();
  }

  get highlighted(): boolean {
    return this.#highlighted;
  }

  set highlighted(
    highlighted: boolean
  ) {
    if (highlighted === this.#highlighted) {
      return;
    }

    this.#highlighted = highlighted;
    this.redraw();
  }

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const color = this.#highlighted ?
      HANDLE_HIGHLIGHT_COLOR :
      AXIS_COLOR[this.axis];
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    context.beginPath();
    context.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
    context.fillStyle = kBackground;
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = color;
    context.stroke();

    context.fillStyle = color;
    context.fillRect(
      centerX - 4,
      centerY - (radius * 0.55),
      8,
      radius * 1.1
    );
    for (const side of [-1, 1]) {
      const base = centerX + (side * radius * 0.2);
      const tip = centerX + (side * radius * 0.72);

      context.beginPath();
      context.moveTo(base, centerY - (radius * 0.42));
      context.lineTo(tip, centerY);
      context.lineTo(base, centerY + (radius * 0.42));
      context.closePath();
      context.fill();
    }
  }
}
