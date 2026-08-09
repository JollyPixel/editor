// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import type { PixelDocument } from "./PixelDocument.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  OverlayLayer
} from "./rendering/OverlayLayer.ts";
import {
  Viewport
} from "./rendering/Viewport.ts";
import type { ZoomOptions } from "./rendering/Zoom.ts";
import { clamp } from "./utils/math.ts";
import type {
  BrushHighlight,
  ColorInput,
  RGBA,
  Vec2
} from "./types.ts";

export interface CanvasViewOptions {
  /**
   * Element the canvas and SVG overlays are mounted into.
   */
  parent: HTMLDivElement;
  zoom?: ZoomOptions;
  /**
   * Canvas color outside texture bounds. When omitted it is resolved from
   * the parent's computed background color, falling back to `#424242`.
   */
  background?: ColorInput;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  /**
   * Highlight spec (size + colors) driving the brush/line/selection overlays.
   */
  brushHighlight: BrushHighlight;
  /**
   * Explicit fill for a peer's vacated selection footprint.
   * @default null (dominant neighbor color)
   */
  eraseColor?: RGBA | null;
}

/**
 * The view: the pixel canvas, its SVG overlays, and the viewport camera. It
 * owns everything needed to paint the current document state
 */
export class CanvasView {
  readonly viewport: Viewport;
  readonly renderer: CanvasRenderer;
  readonly overlays: OverlayLayer;

  constructor(
    doc: PixelDocument,
    options: CanvasViewOptions
  ) {
    const { parent } = options;
    const textureSize = doc.size();

    const initialBounds = parent.getBoundingClientRect();
    const zoomDefault = options.zoom?.default ?? CanvasView.#computeFitZoom(
      initialBounds,
      textureSize,
      { min: options.zoom?.min, max: options.zoom?.max }
    );

    this.viewport = new Viewport({
      textureSize,
      zoom: zoomDefault,
      zoomMin: options.zoom?.min,
      zoomMax: options.zoom?.max,
      zoomSensitivity: options.zoom?.sensitivity
    });

    const computedBackgroundColor = getComputedStyle(parent).backgroundColor;
    const backgroundColor = options.background ?? (
      computedBackgroundColor && new Color(computedBackgroundColor).alpha > 0
        ? computedBackgroundColor
        : "#424242"
    );

    this.renderer = new CanvasRenderer({
      viewport: this.viewport,
      canvasBuffer: doc.buffer,
      bgSquareSize: options.backgroundTransparency?.squareSize,
      bgColors: options.backgroundTransparency?.colors,
      backgroundColor,
      eraseColor: options.eraseColor
    });

    this.renderer.appendTo(parent);

    const bounds = parent.getBoundingClientRect();
    this.renderer.resize(bounds.width, bounds.height);
    this.viewport.updateCanvasSize(bounds.width, bounds.height);

    this.overlays = new OverlayLayer({
      parent,
      viewport: this.viewport,
      brush: options.brushHighlight,
      uvMap: doc.uv
    });

    // Repaint on pixel/floating-selection changes; no overlay refresh needed.
    doc.onChange(() => this.renderer.drawFrame());
    this.renderer.floatingSelection.on(
      "changed",
      () => this.renderer.drawFrame()
    );
    this.renderer.peerStrokeGhosts.on(
      "changed",
      () => this.renderer.drawFrame()
    );
    this.renderer.peerFloatingSelectionGhosts.on(
      "changed",
      () => this.renderer.drawFrame()
    );
  }

  get backgroundColor(): string {
    return this.renderer.backgroundColor;
  }

  set backgroundColor(
    color: ColorInput
  ) {
    this.renderer.backgroundColor = color;
  }

  canvas(): HTMLCanvasElement {
    return this.renderer.canvas();
  }

  drawFrame(): void {
    this.renderer.drawFrame();
  }

  resize(
    width: number,
    height: number
  ): void {
    // Resize surfaces first; viewport "changed" then drives repaint + refresh.
    this.renderer.resize(width, height);
    this.overlays.resize(width, height);
    this.viewport.resizeCanvas(width, height);
  }

  centerTexture(): void {
    // viewport.centerTexture() emits "changed" to trigger repaint.
    this.viewport.centerTexture();
  }

  reparentTo(
    newParentElement: HTMLDivElement
  ): void {
    this.renderer.reparentTo(newParentElement);
    this.overlays.reparentTo(newParentElement);
  }

  destroy(): void {
    const rendererCanvas = this.renderer.canvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.overlays.destroy();
    this.renderer.peerStrokeGhosts.destroy();
    this.renderer.peerFloatingSelectionGhosts.destroy();
  }

  /**
   * Fit-zoom for initial display when `zoom.default` is omitted.
   * Falls back to 4 when the container has no measurable size yet.
   */
  static #computeFitZoom(
    containerSize: { width: number; height: number; },
    textureSize: Vec2,
    zoomBounds: { min?: number; max?: number; }
  ): number {
    const zoomMin = zoomBounds.min ?? 1;
    const zoomMax = zoomBounds.max ?? 32;

    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return clamp(4, zoomMin, zoomMax);
    }

    // Leaves a small margin so the texture isn't flush against the edges.
    const kFitPadding = 0.9;
    const fit = Math.min(
      containerSize.width / textureSize.x,
      containerSize.height / textureSize.y
    ) * kFitPadding;

    return clamp(Math.floor(fit), zoomMin, zoomMax);
  }
}
