// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import type { ColorInput, DefaultViewport, RGBA, SelectionRect } from "../types.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";

export interface FloatingOverlayOptions {
  /** The selection's original position, rendered as eraseColor while floating. */
  sourceRect: SelectionRect;
  /** Row-major pixel data (sourceRect.width * sourceRect.height long). */
  pixels: RGBA[];
  eraseColor: RGBA;
  /**
   * Whether to preview sourceRect as vacated (filled with eraseColor) while
   * dragging. Set false for a just-pasted selection's first move, whose
   * source still holds real content that dropping will NOT erase — blanking
   * it during the drag would misleadingly hide that content.
   * @default true
   */
  blankSource?: boolean;
}

export interface CanvasRendererOptions {
  viewport: DefaultViewport;
  canvasBuffer: CanvasBuffer;
  /**
   * Size of the squares in the background checkerboard pattern. Should be a positive integer.
   * @default 8
   */
  bgSquareSize?: number;
  /**
   * Colors used for the background checkerboard pattern. Accepts CSS color
   * strings or colorjs.io `Color` instances.
   * @default { odd: "#999", even: "#666" }
   */
  bgColors?: {
    odd: ColorInput;
    even: ColorInput;
  };
  /**
   * Background color used when texture has transparent pixels. Accepts a
   * CSS color string or a colorjs.io `Color` instance.
   * @default "#555555"
   */
  backgroundColor?: ColorInput;
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
  #canvasBuffer: CanvasBuffer;
  #floatingCanvas: HTMLCanvasElement | null = null;
  #floatingEraseCanvas: HTMLCanvasElement | null = null;
  #floatingSourceRect: SelectionRect | null = null;
  #floatingLiveRect: SelectionRect | null = null;
  #floatingBlankSource: boolean = true;

  constructor(
    options: CanvasRendererOptions
  ) {
    const {
      viewport,
      canvasBuffer,
      bgSquareSize = 8,
      bgColors = { odd: "#999", even: "#666" },
      backgroundColor = "#555555"
    } = options;

    this.#viewport = viewport;
    this.#canvasBuffer = canvasBuffer;
    this.#bgSquareSize = bgSquareSize;
    this.#bgColors = {
      odd: new Color(bgColors.odd).toString(),
      even: new Color(bgColors.even).toString()
    };
    this.#backgroundColor = new Color(backgroundColor).toString();

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
    const texPx = this.#canvasBuffer.getSize();
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
    this.#ctx.drawImage(this.#canvasBuffer.getCanvas(), 0, 0);

    if (this.#floatingCanvas && this.#floatingSourceRect && this.#floatingLiveRect) {
      if (this.#floatingBlankSource && this.#floatingEraseCanvas) {
        // Blitted (drawImage), not fillRect: fillRect anti-aliases its own
        // edges under a scaled transform while drawImage (with smoothing
        // off) doesn't, and mixing the two left a thin seam at the boundary
        // whenever zoom/camera didn't land on whole device pixels.
        const source = this.#floatingSourceRect;
        this.#ctx.drawImage(this.#floatingEraseCanvas, 0, 0, 1, 1, source.x, source.y, source.width, source.height);
      }

      const live = this.#floatingLiveRect;
      this.#ctx.drawImage(this.#floatingCanvas, live.x, live.y, live.width, live.height);
    }

    this.#ctx.restore();
  }

  /**
   * Renders a selection's captured pixels as a display-only overlay on top
   * of the base texture, blanking its original position with `eraseColor`
   * (so it doesn't look duplicated while floating). The real CanvasBuffer is
   * never touched — CanvasManager commits the actual move/paste separately,
   * once, on drop.
   */
  setFloatingOverlay(
    options: FloatingOverlayOptions
  ): void {
    const { sourceRect, pixels, eraseColor, blankSource = true } = options;

    const canvas = document.createElement("canvas");
    canvas.width = sourceRect.width;
    canvas.height = sourceRect.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const imageData = ctx.createImageData(sourceRect.width, sourceRect.height);
    for (let i = 0; i < pixels.length; i++) {
      const { r, g, b, a } = pixels[i];
      const index = i * 4;
      imageData.data[index] = r;
      imageData.data[index + 1] = g;
      imageData.data[index + 2] = b;
      imageData.data[index + 3] = a;
    }
    ctx.putImageData(imageData, 0, 0);

    const eraseCanvas = document.createElement("canvas");
    eraseCanvas.width = 1;
    eraseCanvas.height = 1;
    const eraseCtx = eraseCanvas.getContext("2d")!;
    eraseCtx.imageSmoothingEnabled = false;
    const eraseImageData = eraseCtx.createImageData(1, 1);
    eraseImageData.data[0] = eraseColor.r;
    eraseImageData.data[1] = eraseColor.g;
    eraseImageData.data[2] = eraseColor.b;
    eraseImageData.data[3] = eraseColor.a;
    eraseCtx.putImageData(eraseImageData, 0, 0);

    this.#floatingCanvas = canvas;
    this.#floatingEraseCanvas = eraseCanvas;
    this.#floatingSourceRect = sourceRect;
    this.#floatingLiveRect = sourceRect;
    this.#floatingBlankSource = blankSource;
  }

  /**
   * Updates the floating overlay's live (drag) position without rebuilding
   * its pixel content. No-op when no overlay is active.
   */
  updateFloatingOverlayPosition(
    liveRect: SelectionRect
  ): void {
    if (!this.#floatingCanvas) {
      return;
    }

    this.#floatingLiveRect = liveRect;
  }

  clearFloatingOverlay(): void {
    this.#floatingCanvas = null;
    this.#floatingEraseCanvas = null;
    this.#floatingSourceRect = null;
    this.#floatingLiveRect = null;
    this.#floatingBlankSource = true;
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
