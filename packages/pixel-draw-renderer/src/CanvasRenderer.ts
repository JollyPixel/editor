// Import Internal Dependencies
import type { DefaultViewport } from "./types.ts";
import type { TextureBuffer } from "./TextureBuffer.ts";

export interface CanvasRendererOptions {
  viewport: DefaultViewport;
  textureBuffer: TextureBuffer;
  /**
   * Size of the squares in the background checkerboard pattern. Should be a positive integer.
   * @default 8
   */
  bgSquareSize?: number;
  /**
   * Colors used for the background checkerboard pattern. Should be valid CSS color strings.
   * @default { odd: "#999", even: "#666" }
   */
  bgColors?: {
    odd: string;
    even: string;
  };
  /**
   * Background color used when texture has transparent pixels. Should be a valid CSS color string.
   * @default "#555555"
   */
  backgroundColor?: string;
}

/**
 * CanvasRenderer is responsible for rendering the pixel art canvas, including the texture and the background checkerboard pattern.
 * It manages an off-screen canvas for the background pattern and the main canvas for rendering the texture.
 * The renderer listens to changes in the viewport and texture buffer to update the display accordingly.
 */
export class CanvasRenderer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #bgCanvas: HTMLCanvasElement;
  #bgCtx: CanvasRenderingContext2D;
  #bgSquareSize: number;
  #bgColors: { odd: string; even: string; };
  #backgroundColor: string;
  #viewport: DefaultViewport;
  #textureBuffer: TextureBuffer;

  constructor(
    options: CanvasRendererOptions
  ) {
    const {
      viewport,
      textureBuffer,
      bgSquareSize = 8,
      bgColors = { odd: "#999", even: "#666" },
      backgroundColor = "#555555"
    } = options;

    this.#viewport = viewport;
    this.#textureBuffer = textureBuffer;
    this.#bgSquareSize = bgSquareSize;
    this.#bgColors = bgColors;
    this.#backgroundColor = backgroundColor;

    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext("2d")!;
    this.#ctx.imageSmoothingEnabled = false;

    this.#bgCanvas = document.createElement("canvas");
    this.#bgCtx = this.#bgCanvas.getContext("2d")!;
  }

  getCanvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  drawFrame(): void {
    if (this.#canvas.width === 0 || this.#canvas.height === 0) {
      return;
    }

    const { zoom, camera } = this.#viewport;
    const texPx = this.#textureBuffer.getSize();
    const texPixelW = texPx.x * zoom;
    const texPixelH = texPx.y * zoom;

    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.fillStyle = this.#backgroundColor;
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

    this.#ctx.save();
    this.#ctx.beginPath();
    this.#ctx.rect(camera.x, camera.y, texPixelW, texPixelH);
    this.#ctx.clip();

    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.drawImage(this.#bgCanvas, 0, 0);

    this.#ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);
    this.#ctx.drawImage(this.#textureBuffer.getCanvas(), 0, 0);

    this.#ctx.restore();
  }

  resize(
    width: number,
    height: number
  ): void {
    this.#canvas.width = Math.round(width);
    this.#canvas.height = Math.round(height);
    this.#ctx.imageSmoothingEnabled = false;

    this.#bgCanvas.width = this.#canvas.width;
    this.#bgCanvas.height = this.#canvas.height;
    this.#drawBgTransparency();
  }

  #drawBgTransparency(): void {
    const sq = this.#bgSquareSize;
    const colors = this.#bgColors;

    for (let y = 0; y < this.#bgCanvas.height; y += sq) {
      for (let x = 0; x < this.#bgCanvas.width; x += sq) {
        const isLight = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0;
        this.#bgCtx.fillStyle = isLight ? colors.odd : colors.even;
        this.#bgCtx.fillRect(x, y, sq, sq);
      }
    }
  }

  appendTo(
    parent: HTMLElement
  ): void {
    Object.assign(this.#canvas.style, {
      width: "100%",
      height: "100%",
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "0"
    });

    parent.style.position = "relative";
    parent.appendChild(this.#canvas);
  }

  reparentTo(
    parent: HTMLElement
  ): void {
    if (this.#canvas.parentElement) {
      this.#canvas.remove();
    }

    parent.appendChild(this.#canvas);

    const bounds = parent.getBoundingClientRect();
    this.resize(bounds.width, bounds.height);
  }
}
