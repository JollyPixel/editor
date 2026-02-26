// Import Internal Dependencies
import {
  BrushManager,
  type BrushManagerOptions
} from "./BrushManager.ts";
import {
  CanvasRenderer
} from "./CanvasRenderer.ts";
import {
  InputController
} from "./InputController.ts";
import {
  SvgManager
} from "./SvgManager.ts";
import {
  TextureBuffer
} from "./TextureBuffer.ts";
import {
  Viewport
} from "./Viewport.ts";
import type {
  Brush,
  DefaultViewport,
  Mode,
  Vec2
} from "./types.ts";

export type { Mode };

export interface CanvasManagerOptions {
  /**
   * Default interaction mode for the canvas.
   * Can be either "paint" for drawing or "move" for panning.
   * If not specified, the default mode will be "paint".
   */
  defaultMode?: Mode;
  texture?: {
    defaultColor?: string;
    size?: { x: number; y?: number; };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
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

export class CanvasManager {
  #parentHtmlElement: HTMLDivElement;
  #viewport: Viewport;
  #textureBuffer: TextureBuffer;
  #renderer: CanvasRenderer;
  #input: InputController;
  #svgManager: SvgManager;

  readonly brush: BrushManager;
  readonly viewport: DefaultViewport;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: CanvasManagerOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.#viewport = new Viewport({
      textureSize,
      zoom: options.zoom?.default,
      zoomMin: options.zoom?.min,
      zoomMax: options.zoom?.max,
      zoomSensitivity: options.zoom?.sensitivity
    });
    this.viewport = this.#viewport;

    this.#textureBuffer = new TextureBuffer({
      textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize
    });

    if (options.texture?.init) {
      this.#textureBuffer.setTexture(options.texture.init);
    }

    const backgroundColor = getComputedStyle(parentHtmlElement).backgroundColor || "#555555";

    this.#renderer = new CanvasRenderer({
      viewport: this.#viewport,
      textureBuffer: this.#textureBuffer,
      bgSquareSize: options.backgroundTransparency?.squareSize,
      bgColors: options.backgroundTransparency?.colors,
      backgroundColor
    });

    this.#renderer.appendTo(parentHtmlElement);

    const bounds = parentHtmlElement.getBoundingClientRect();
    this.#renderer.resize(bounds.width, bounds.height);
    this.#viewport.updateCanvasSize(bounds.width, bounds.height);

    this.brush = new BrushManager(options.brush);

    const brushRef = this.brush;
    const viewportRef: DefaultViewport = this.#viewport;

    const brushAdapter: Brush = {
      get size() {
        return brushRef.getSize();
      },
      get colorInline() {
        return brushRef.getColorInline();
      },
      get colorOutline() {
        return brushRef.getColorOutline();
      }
    };

    this.#svgManager = new SvgManager({
      parent: parentHtmlElement,
      viewport: viewportRef,
      brush: brushAdapter,
      textureSize
    });

    this.#input = new InputController({
      canvas: this.#renderer.getCanvas(),
      viewport: this.#viewport,
      mode: options.defaultMode,
      actions: {
        onDrawStart: (tx, ty) => {
          this.#drawColor(tx, ty);
        },
        onDrawMove: (tx, ty) => {
          this.#drawColor(tx, ty);
        },
        onDrawEnd: () => {
          this.#textureBuffer.copyToMaster();
        },
        onPanStart: (_mx, _my) => {
          // pan tracking is inside InputController
        },
        onPanMove: (dx, dy) => {
          this.#viewport.applyPan(dx, dy);
          this.#renderer.drawFrame();
        },
        onPanEnd: () => {
          // nothing extra needed
        },
        onZoom: (delta, cx, cy) => {
          this.#viewport.applyZoom(delta, cx, cy);
          this.#renderer.drawFrame();
        },
        onColorPick: (tx, ty) => {
          const [r, g, b, a] = this.#textureBuffer.samplePixel(tx, ty);
          const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
          const opacity = a / 255;
          this.brush.setColorWithOpacity(hex, opacity);
          this.#emitColorPickedEvent({ hex, opacity });
        },
        onMouseMove: (cx, cy) => {
          if (cx < 0 || cy < 0) {
            this.#svgManager.updateBrushHighlight(null, null);
          }
          else if (this.#input.getMode() === "paint") {
            this.#svgManager.updateBrushHighlight(cx, cy);
          }
        }
      }
    });

    this.centerTexture();
  }

  getMode(): Mode {
    return this.#input.getMode();
  }

  setMode(
    mode: Mode
  ): void {
    this.#input.setMode(mode);
    if (mode === "move") {
      this.#svgManager.hideSvgHighlight();
    }
  }

  getParentHtmlElement(): HTMLDivElement {
    return this.#parentHtmlElement;
  }

  reparentCanvasTo(
    newParentElement: HTMLDivElement
  ): void {
    if (!newParentElement) {
      console.error("CanvasManager: Invalid parent element");

      return;
    }

    this.#renderer.reparentTo(newParentElement);
    this.#svgManager.reparentSvgTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  getTextureSize(): Vec2 {
    return this.#textureBuffer.getSize();
  }

  setTextureSize(
    size: Vec2
  ): void {
    if (size.x <= 0 || size.y <= 0) {
      console.error("CanvasManager: Texture size must be positive");

      return;
    }

    this.#textureBuffer.setSize(size);
    this.#viewport.setTextureSize(size);
    this.#svgManager.setTextureSize(size);
    this.#renderer.drawFrame();
  }

  getCamera(): Vec2 {
    return { ...this.#viewport.camera };
  }

  getZoom(): number {
    return this.#viewport.zoom;
  }

  centerTexture(): void {
    this.#viewport.centerTexture();
    this.#renderer.drawFrame();
  }

  onResize(): void {
    const bounds = this.#parentHtmlElement.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }

    this.#renderer.resize(bounds.width, bounds.height);
    this.#viewport.updateCanvasSize(bounds.width, bounds.height);
    this.#svgManager.updateSvgSize(bounds.width, bounds.height);
    this.centerTexture();
  }

  getTextureCanvas(): HTMLCanvasElement {
    return this.#textureBuffer.getCanvas();
  }

  setTexture(
    canvas: HTMLCanvasElement
  ): void {
    this.#textureBuffer.setTexture(canvas);
    this.#viewport.setTextureSize({ x: canvas.width, y: canvas.height });
    this.#renderer.drawFrame();
  }

  getTexture(): Uint8ClampedArray {
    return this.#textureBuffer.getPixels();
  }

  #drawColor(
    tx: number,
    ty: number,
    color?: string
  ): void {
    const pixelColor = color ?? this.brush.getColor();
    const match = pixelColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
    if (!match) {
      return;
    }

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] === undefined ? 255 : Math.floor(parseFloat(match[4]) * 255);

    const pixels = this.brush.getAffectedPixels(tx, ty);
    this.#textureBuffer.drawPixels(pixels, { r, g, b, a });
    this.#renderer.drawFrame();
  }

  #emitColorPickedEvent(
    color: { hex: string; opacity: number; }
  ): void {
    const event = new CustomEvent("colorpicked", {
      detail: color,
      bubbles: true,
      composed: true
    });
    this.#renderer.getCanvas().dispatchEvent(event);
  }
}
