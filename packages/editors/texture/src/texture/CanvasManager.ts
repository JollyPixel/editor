/* eslint-disable @stylistic/no-mixed-operators */
// Import Internal Dependencies
import BrushManager, { type BrushManagerOptions } from "./BrushManager.js";
import SvgManager, { type SvgManagerOptions } from "./SvgManager.js";

export type Mode = "paint" | "move";

export interface CanvasManagerOptions {
  defaultMode?: Mode;
  texture?: {
    defaultColor?: string;
    size?: { x: number; y?: number; };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
  uv?: SvgManagerOptions;
  zoom?: {
    default: number;
    sensitivity?: number;
    min?: number;
    max?: number;
  };
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  brush?: BrushManagerOptions;
}

export default class CanvasManager {
  private parentHtmlElement: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private boundingRect: DOMRect;
  private ctx: CanvasRenderingContext2D;

  private backgroundColor: string;
  private textureSize: { x: number; y: number; };
  private textureMaxSize: number = 2048;

  // Here to have backup when resizing your texture
  private masterTextureCanvas: HTMLCanvasElement;
  private masterTextureCtx: CanvasRenderingContext2D;

  private textureCanvas: HTMLCanvasElement;
  private textureCtx: CanvasRenderingContext2D;

  private texturePixelWidth: number;
  private texturePixelHeight: number;
  private defaultTextureColor: string;

  private backgroundTransparencyCanvas: HTMLCanvasElement;
  private backgroundTransparencyCtx: CanvasRenderingContext2D;

  private camera: { x: number; y: number; } = { x: 0, y: 0 };
  private isPanning: boolean = false;
  private panStart: { x: number; y: number; } = { x: 0, y: 0 };
  // private panSensitivity: number = 0.1;

  private mode: Mode;

  private zoom: number;
  private zoomMin: number;
  private zoomMax: number;
  private zoomSensitivity: number = 0.1;

  private isDrawing: boolean = false;
  private lastCanvasMouseDrawPos: { x: number; y: number; };

  private SvgMananager: SvgManager;

  public brush: BrushManager;

  constructor(parentHtmlElement: HTMLDivElement, options: CanvasManagerOptions = {}) {
    this.parentHtmlElement = parentHtmlElement;
    this.boundingRect = this.parentHtmlElement.getBoundingClientRect();
    this.canvas = this.initCanvasHtmlElement();

    if (!this.canvas.getContext("2d")) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;

    this.zoomMin = options.zoom?.min || 1;
    this.zoomMax = options.zoom?.max || 32;
    if (this.zoomMax < this.zoomMin) {
      throw new Error(`Max zoom (${options.zoom?.max}) can't be under min zoom ${this.zoomMin}`);
    }
    this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, options.zoom?.default || 4));
    this.zoomSensitivity = options.zoom?.sensitivity || 0.1;

    if (options.texture?.size === undefined) {
      this.textureSize = { x: 64, y: 32 };
    }
    else {
      this.textureSize = {
        x: options.texture.size.x,
        y: options.texture.size?.y || options.texture.size.x
      };
    }
    this.defaultTextureColor = options.texture?.defaultColor || "#ffffff";
    this.backgroundColor = getComputedStyle(this.parentHtmlElement).backgroundColor || "#555555";

    this.texturePixelWidth = this.textureSize.x * this.zoom;
    this.texturePixelHeight = this.textureSize.y * this.zoom;
    this.centerTexture();

    // BackgroundTransparency
    this.backgroundTransparencyCanvas = document.createElement("canvas");
    this.backgroundTransparencyCtx = this.backgroundTransparencyCanvas.getContext("2d")!;
    this.initBackgroundTransparency(
      options.backgroundTransparency?.squareSize || 8,
      {
        odd: options.backgroundTransparency?.colors.odd || "#999",
        even: options.backgroundTransparency?.colors.even || "#666"
      }
    );
    this.masterTextureCanvas = document.createElement("canvas");
    this.masterTextureCtx = this.masterTextureCanvas.getContext("2d")!;

    if (options.texture?.init) {
      this.setTexture(options.texture?.init);
    }
    else {
      this.textureCanvas = document.createElement("canvas");
      this.textureCtx = this.textureCanvas.getContext("2d")!;
      this.initTexture();
    }

    this.mode = options.defaultMode || "paint";

    this.brush = new BrushManager(options.brush);

    this.SvgMananager = new SvgManager(this);

    this.canvas.addEventListener("mousemove", (e) => {
      e.preventDefault();

      if (this.mode === "paint" && e.button === 0) {
        const { x, y } = this.getMouseCanvasPosition(e.clientX, e.clientY);
        this.SvgMananager.updateBrushHighlight(x, y);
        this.drawing(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.SvgMananager.updateBrushHighlight(null, null);
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();

      this.zooming(e.deltaY, e.clientX, e.clientY);
      if (this.mode === "paint") {
        const { x, y } = this.getMouseCanvasPosition(e.clientX, e.clientY);
        this.SvgMananager.updateBrushHighlight(x, y);
      }
    }, { passive: false });

    this.canvas.addEventListener("mousedown", (e) => {
      if (this.mode === "paint" && e.button === 0) {
        this.startDraw(e.clientX, e.clientY);
      }

      if (e.button === 1) {
        this.startPan(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.mode === "paint" && e.button === 2) {
        const pixelColor = this.colorPicker(e.clientX, e.clientY);
        this.brush.setColorWithOpacity(pixelColor.hex, pixelColor.opacity);
        this.emitColorPickedEvent(pixelColor);
      }
    });

    window.addEventListener("mousemove", (e) => {
      this.panning(e.clientX, e.clientY);
    });

    window.addEventListener("mouseup", (e) => {
      this.endPan();
      if (this.isDrawing) {
        this.endDraw(e.clientX, e.clientY);
      }
    });

    window.addEventListener("resize", () => {
      this.onResize();
    });

    if (this.boundingRect.width > 0 && this.boundingRect.height > 0) {
      this.drawTexture();
    }
  }

  getMode(): Mode {
    return this.mode;
  }
  setMode(mode: Mode) {
    this.mode = mode;
    if (mode === "move") {
      this.SvgMananager.hideSvgHighlight();
    }
  }

  getParentHtmlElement(): HTMLDivElement {
    return this.parentHtmlElement;
  }

  public reparentCanvasTo(newParentElement: HTMLDivElement): void {
    if (!this.canvas) {
      console.error("CanvasManager: No canvas to reparent");

      return;
    }

    if (!newParentElement) {
      console.error("CanvasManager: Invalid parent element");

      return;
    }

    if (this.canvas.parentElement) {
      this.canvas.remove();
    }

    newParentElement.appendChild(this.canvas);

    this.SvgMananager.reparentSvgTo(newParentElement);

    this.parentHtmlElement = newParentElement;

    this.onResize();
  }

  getTextureSize(): { x: number; y: number; } {
    return this.textureSize;
  }

  setTextureSize(size: { x: number; y: number; }): void {
    if (size.x <= 0 || size.y <= 0) {
      console.error("CanvasManager: Texture size must be positive");

      return;
    }

    if (size.x > this.textureMaxSize || size.y > this.textureMaxSize) {
      console.error(`CanvasManager: Texture size exceeds max size of ${this.textureMaxSize}`);

      return;
    }

    const masterImageData = this.masterTextureCtx.getImageData(0, 0, this.textureMaxSize, this.textureMaxSize);

    this.textureSize = size;

    this.textureCanvas.width = size.x;
    this.textureCanvas.height = size.y;

    const newImageData = this.textureCtx.createImageData(size.x, size.y);

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const masterIndex = (y * this.textureMaxSize + x) * 4;
        const newIndex = (y * size.x + x) * 4;

        newImageData.data[newIndex] = masterImageData.data[masterIndex];
        newImageData.data[newIndex + 1] = masterImageData.data[masterIndex + 1];
        newImageData.data[newIndex + 2] = masterImageData.data[masterIndex + 2];
        newImageData.data[newIndex + 3] = masterImageData.data[masterIndex + 3];
      }
    }
    this.textureCtx.putImageData(newImageData, 0, 0);

    this.texturePixelWidth = this.textureSize.x * this.zoom;
    this.texturePixelHeight = this.textureSize.y * this.zoom;

    this.drawTexture();
  }

  getCamera(): { x: number; y: number; } {
    return this.camera;
  }

  getZoom(): number {
    return this.zoom;
  }

  private initCanvasHtmlElement(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");

    this.parentHtmlElement.style.position = "relative";

    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "0"
    });

    canvas.width = this.boundingRect.width;
    canvas.height = this.boundingRect.height;
    this.parentHtmlElement.appendChild(canvas);

    return canvas;
  }

  private initBackgroundTransparency(squareSize: number, colors: { odd: string; even: string; }) {
    this.backgroundTransparencyCanvas.width = this.canvas.width;
    this.backgroundTransparencyCanvas.height = this.canvas.height;

    for (let y = 0; y < this.backgroundTransparencyCanvas.height; y += squareSize) {
      for (let x = 0; x < this.backgroundTransparencyCanvas.width; x += squareSize) {
        const isLight = ((x / squareSize) + (y / squareSize)) % 2 === 0;
        this.backgroundTransparencyCtx.fillStyle = isLight ? colors.odd : colors.even;
        this.backgroundTransparencyCtx.fillRect(x, y, squareSize, squareSize);
      }
    }
  }

  private initTexture() {
    this.masterTextureCanvas.width = this.textureMaxSize;
    this.masterTextureCanvas.height = this.textureMaxSize;
    this.textureCanvas.width = this.textureSize.x;
    this.textureCanvas.height = this.textureSize.y;

    const masterTextureImageData = this.masterTextureCtx.createImageData(this.textureMaxSize, this.textureMaxSize);
    const textureImageData = this.textureCtx.createImageData(this.textureSize.x, this.textureSize.y);

    this.masterTextureCtx.imageSmoothingEnabled = false;
    this.textureCtx.imageSmoothingEnabled = false;

    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = this.defaultTextureColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

    for (let i = 0; i < masterTextureImageData.data.length; i += 4) {
      let alpha = a;
      if (i === 0) {
        alpha = 0;
      }
      masterTextureImageData.data[i] = r;
      masterTextureImageData.data[i + 1] = g;
      masterTextureImageData.data[i + 2] = b;
      masterTextureImageData.data[i + 3] = alpha;

      if (i >= textureImageData.data.length) {
        continue;
      }

      textureImageData.data[i] = r;
      textureImageData.data[i + 1] = g;
      textureImageData.data[i + 2] = b;
      textureImageData.data[i + 3] = alpha;
    }
    this.masterTextureCtx.putImageData(masterTextureImageData, 0, 0);
    this.textureCtx.putImageData(textureImageData, 0, 0);
  }

  private drawTexture() {
    // Don't draw if canvas has invalid dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      return;
    }

    // Reinitialize transform to clean the canvas easier
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // if texture is smaller in the canvas there will be the background canvas that appears
    // so, need to get the background color of the canvas to have the same color around the texture
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Clip on the texture position to draw bgTransparency and texture
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.camera.x, this.camera.y, this.texturePixelWidth, this.texturePixelHeight);
    this.ctx.clip();

    // Reinit transform to draw the bgTransparancy to be fixe
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.backgroundTransparencyCanvas, 0, 0);

    // reapply transform to draw the texture
    this.ctx.setTransform(
      this.zoom,
      0,
      0,
      this.zoom,
      this.camera.x,
      this.camera.y
    );
    this.ctx.drawImage(this.textureCanvas, 0, 0);

    this.ctx.restore();
  }

  private drawColor(x: number, y: number, color?: string) {
    const pixelColor = color || this.brush.getColor();
    const match = pixelColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
    if (!match) {
      return;
    }

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] === undefined ? 255 : Math.floor(parseFloat(match[4]) * 255);

    const pixels = this.brush.getAffectedPixels(x, y);
    for (const pixel of pixels) {
      const imageData = this.textureCtx.getImageData(pixel.x, pixel.y, 1, 1);
      const data = imageData.data;

      data[0] = r;
      data[1] = g;
      data[2] = b;
      data[3] = a;

      this.textureCtx.putImageData(imageData, pixel.x, pixel.y);
    }
    this.drawTexture();
  }

  private colorPicker(x: number, y: number): { hex: string; opacity: number; } {
    const pixelPos = this.getMouseTexturePosition(x, y, true);
    if (pixelPos === null) {
      return { hex: this.brush.getColor(), opacity: this.brush.getOpacity() };
    }

    const imageData = this.textureCtx.getImageData(pixelPos.x, pixelPos.y, 1, 1);
    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    const a = imageData.data[3] / 255;

    const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;

    return { hex, opacity: a };
  }

  private emitColorPickedEvent(color: { hex: string; opacity: number; }): void {
    const event = new CustomEvent("colorpicked", {
      detail: color,
      bubbles: true,
      composed: true
    });
    this.canvas.dispatchEvent(event);
  }

  private getMouseCanvasPosition(mouseX: number, mouseY: number): { x: number; y: number; } {
    const x = Math.floor(mouseX - this.boundingRect.left);
    const y = Math.floor(mouseY - this.boundingRect.top);

    return { x, y };
  }

  private getMouseTexturePosition(mouseX: number, mouseY: number, limit: boolean = false):
  { x: number; y: number; } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((mouseX - rect.left - this.camera.x) / this.zoom);
    const y = Math.floor((mouseY - rect.top - this.camera.y) / this.zoom);

    if (limit) {
      if (x < 0 || x >= this.textureSize.x || y < 0 || y >= this.textureSize.y) {
        return null;
      }
    }

    return { x, y };
  }

  private startPan(mouseX: number, mouseY: number) {
    this.isPanning = true;
    this.panStart = { x: mouseX, y: mouseY };
  }

  private endPan() {
    this.isPanning = false;
  }

  private clampCamera() {
    // Allow to keep one pixel visible when clamping
    const margin = this.zoom;

    const minX = -this.texturePixelWidth + margin;
    const maxX = this.canvas.width - margin;

    const minY = -this.texturePixelHeight + margin;
    const maxY = this.canvas.height - margin;

    this.camera.x = Math.max(minX, Math.min(maxX, this.camera.x));
    this.camera.y = Math.max(minY, Math.min(maxY, this.camera.y));
  }

  private panning(mouseX: number, mouseY: number) {
    if (!this.isPanning) {
      return;
    }

    const deltaX = mouseX - this.panStart.x;
    const deltaY = mouseY - this.panStart.y;

    this.camera.x += deltaX;
    this.camera.y += deltaY;

    this.clampCamera();

    this.panStart = { x: mouseX, y: mouseY };

    this.drawTexture();
  }

  private zooming(deltaY: number, mouseX: number, mouseY: number) {
    const x = mouseX - this.boundingRect.left;
    const y = mouseY - this.boundingRect.top;

    const worldX = (x - this.camera.x) / this.zoom;
    const worldY = (y - this.camera.y) / this.zoom;

    const signDelta = Math.sign(deltaY);
    const smoothSensitivity = this.zoom - signDelta * this.zoomSensitivity < 1 || this.zoom < 1 ?
      this.zoomSensitivity / 10 :
      this.zoomSensitivity;
    const newZoom = Math.max(
      this.zoomMin,
      Math.min(
        this.zoomMax,
        this.zoom - signDelta * smoothSensitivity
      )
    );

    this.camera.x -= (worldX * newZoom - worldX * this.zoom);
    this.camera.y -= (worldY * newZoom - worldY * this.zoom);

    this.zoom = newZoom;

    this.texturePixelWidth = this.textureSize.x * this.zoom;
    this.texturePixelHeight = this.textureSize.y * this.zoom;

    this.clampCamera();
    this.drawTexture();
  }

  private startDraw(mouseX: number, mouseY: number) {
    this.isDrawing = true;
    const mousePos = this.getMouseTexturePosition(mouseX, mouseY)!;
    this.drawColor(mousePos.x, mousePos.y);
  }

  private drawing(mouseX: number, mouseY: number) {
    if (!this.isDrawing) {
      return;
    }

    const mousePos = this.getMouseTexturePosition(mouseX, mouseY)!;
    this.drawColor(mousePos.x, mousePos.y);
  }

  private endDraw(mouseX: number, mouseY: number) {
    this.isDrawing = false;
    this.lastCanvasMouseDrawPos = this.getMouseTexturePosition(mouseX, mouseY)!;

    // Sync masterTexture
    const imageData = this.textureCtx.getImageData(0, 0, this.textureSize.x, this.textureSize.y);
    this.masterTextureCtx.putImageData(imageData, 0, 0);
  }

  centerTexture(): void {
    this.camera.x = this.canvas.width / 2 - this.texturePixelWidth / 2;
    this.camera.y = this.canvas.height / 2 - this.texturePixelHeight / 2;
    this.clampCamera();
    this.drawTexture();
  }

  // drawLine(mouseX: number, mouseY: number) {

  // }

  onResize() {
    this.boundingRect = this.parentHtmlElement.getBoundingClientRect();

    if (this.boundingRect.width === 0 || this.boundingRect.height === 0) {
      return;
    }

    this.canvas.width = Math.round(this.boundingRect.width);
    this.canvas.height = Math.round(this.boundingRect.height);
    this.ctx.imageSmoothingEnabled = false;

    this.backgroundTransparencyCanvas.width = this.canvas.width;
    this.backgroundTransparencyCanvas.height = this.canvas.height;
    this.initBackgroundTransparency(
      8, { odd: "#999", even: "#666" }
    );

    this.SvgMananager.updateSvgSize(this.boundingRect.width, this.boundingRect.height);
    this.clampCamera();

    this.drawTexture();
  }

  getTextureCanvas(): HTMLCanvasElement {
    return this.textureCanvas;
  }

  setTexture(canvas: HTMLCanvasElement) {
    this.textureCanvas = canvas;
  }

  getTexture() {
    return this.textureCtx.getImageData(0, 0, this.textureSize.x, this.textureSize.y).data;
  }
}
