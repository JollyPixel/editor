// Import Internal Dependencies
import { toCssColor } from "../utils/colors.ts";
import type {
  ByteColorInput,
  RGBA8
} from "../types.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { DefaultViewport } from "./Viewport.ts";
import {
  FloatingSelection
} from "./compositing/FloatingSelection.ts";
import {
  PeerStrokes
} from "./presence/PeerStrokes.ts";
import {
  PeerFloatingSelections
} from "./presence/PeerFloatingSelections.ts";

export interface CanvasRendererOptions {
  viewport: DefaultViewport;
  canvasBuffer: CanvasBuffer;
  /**
   * Checkerboard square size.
   * @default 8
   */
  bgSquareSize?: number;
  /**
   * Checkerboard colors.
   * @default { odd: "#999", even: "#666" }
   */
  bgColors?: {
    odd: ByteColorInput;
    even: ByteColorInput;
  };
  /**
   * Transparent-pixel background color.
   * @default "#555555"
   */
  backgroundColor?: ByteColorInput;
  /**
   * Explicit fill for a peer's vacated selection-move footprint, mirroring
   * `PixelArtCanvasOptions.select.eraseColor` so both clients blank it equally.
   * @default null (dominant neighbor color)
   */
  eraseColor?: RGBA8 | null;
}

export class CanvasRenderer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #bgCanvas: HTMLCanvasElement;
  #bgCtx: CanvasRenderingContext2D;
  #contentCanvas: HTMLCanvasElement;
  #contentCtx: CanvasRenderingContext2D;
  #bgSquareSize: number;
  #bgColors: { odd: string; even: string; };
  #backgroundColor: string;
  #viewport: DefaultViewport;
  #canvasBuffer: CanvasBuffer;

  readonly floatingSelection: FloatingSelection = new FloatingSelection();
  readonly peerStrokes: PeerStrokes = new PeerStrokes();
  readonly peerFloatingSelections: PeerFloatingSelections;

  constructor(
    options: CanvasRendererOptions
  ) {
    const {
      viewport,
      canvasBuffer,
      bgSquareSize = 8,
      bgColors = {
        odd: "#999",
        even: "#666"
      },
      backgroundColor = "#555555",
      eraseColor = null
    } = options;

    this.#viewport = viewport;
    this.#canvasBuffer = canvasBuffer;
    this.peerFloatingSelections = new PeerFloatingSelections(
      canvasBuffer,
      eraseColor
    );
    this.#bgSquareSize = bgSquareSize;
    this.#bgColors = {
      odd: toCssColor(bgColors.odd),
      even: toCssColor(bgColors.even)
    };
    this.#backgroundColor = toCssColor(backgroundColor);

    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext("2d")!;
    this.#ctx.imageSmoothingEnabled = false;

    this.#bgCanvas = document.createElement("canvas");
    this.#bgCtx = this.#bgCanvas.getContext("2d")!;

    this.#contentCanvas = document.createElement("canvas");
    this.#contentCtx = this.#contentCanvas.getContext("2d")!;
    this.#contentCtx.imageSmoothingEnabled = false;
  }

  canvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  get backgroundColor(): string {
    return this.#backgroundColor;
  }

  set backgroundColor(
    color: ByteColorInput
  ) {
    this.#backgroundColor = toCssColor(color);
    this.drawFrame();
  }

  get cursor(): string {
    return this.#canvas.style.cursor;
  }

  set cursor(
    value: string
  ) {
    this.#canvas.style.cursor = value;
  }

  drawFrame(): void {
    if (
      this.#canvas.width === 0 ||
      this.#canvas.height === 0
    ) {
      return;
    }

    const { zoom, camera } = this.#viewport;
    const texPx = this.#canvasBuffer.size();
    const texPixelW = texPx.x * zoom.value;
    const texPixelH = texPx.y * zoom.value;

    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.fillStyle = this.#backgroundColor;
    this.#ctx.fillRect(
      0,
      0,
      this.#canvas.width,
      this.#canvas.height
    );

    this.#ctx.save();
    this.#ctx.beginPath();
    this.#ctx.rect(
      camera.x,
      camera.y,
      texPixelW,
      texPixelH
    );
    this.#ctx.clip();

    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.drawImage(this.#bgCanvas, 0, 0);

    this.#ctx.setTransform(
      zoom.value,
      0,
      0,
      zoom.value,
      camera.x,
      camera.y
    );
    if (
      this.floatingSelection.isActive ||
      this.peerStrokes.isActive ||
      this.peerFloatingSelections.isActive
    ) {
      this.#drawContent();
      this.#ctx.drawImage(
        this.#contentCanvas,
        0,
        0
      );
    }
    else {
      this.#ctx.drawImage(
        this.#canvasBuffer.canvas(),
        0,
        0
      );
    }

    this.#ctx.restore();
  }

  #drawContent(): void {
    const size = this.#canvasBuffer.size();
    if (
      this.#contentCanvas.width !== size.x ||
      this.#contentCanvas.height !== size.y
    ) {
      this.#contentCanvas.width = size.x;
      this.#contentCanvas.height = size.y;
      this.#contentCtx.imageSmoothingEnabled = false;
    }
    else {
      this.#contentCtx.clearRect(
        0,
        0,
        size.x,
        size.y
      );
    }

    this.#contentCtx.drawImage(
      this.#canvasBuffer.canvas(),
      0,
      0
    );
    this.peerFloatingSelections.draw(this.#contentCtx);
    this.floatingSelection.draw(this.#contentCtx);
    this.peerStrokes.draw(this.#contentCtx);
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

        this.#bgCtx.fillStyle = colors[isLight ? "odd" : "even"];
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
    this.resize(
      bounds.width,
      bounds.height
    );
  }
}
