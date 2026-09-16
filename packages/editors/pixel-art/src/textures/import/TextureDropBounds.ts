// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

export interface TextureDropBoundsInit {
  left: number;
  top: number;
  width: number;
  height: number;
  stageLeft: number;
  stageTop: number;
}

export class TextureDropBounds {
  static measure(
    canvas: PixelArtCanvas,
    stage: HTMLElement
  ): TextureDropBounds {
    const canvasBounds = canvas.canvas().getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const { camera, zoom, textureSize } = canvas;

    return new TextureDropBounds({
      left: canvasBounds.left - stageBounds.left + camera.x,
      top: canvasBounds.top - stageBounds.top + camera.y,
      width: textureSize.x * zoom.value,
      height: textureSize.y * zoom.value,
      stageLeft: stageBounds.left,
      stageTop: stageBounds.top
    });
  }

  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly #stageLeft: number;
  readonly #stageTop: number;

  constructor(
    init: TextureDropBoundsInit
  ) {
    this.left = init.left;
    this.top = init.top;
    this.width = init.width;
    this.height = init.height;
    this.#stageLeft = init.stageLeft;
    this.#stageTop = init.stageTop;
    Object.freeze(this);
  }

  contains(
    clientX: number,
    clientY: number
  ): boolean {
    const x = clientX - this.#stageLeft;
    const y = clientY - this.#stageTop;

    return x >= this.left &&
      x < this.left + this.width &&
      y >= this.top &&
      y < this.top + this.height;
  }

  toStyle(): string {
    return `left: ${this.left}px; top: ${this.top}px; ` +
      `width: ${this.width}px; height: ${this.height}px;`;
  }
}
