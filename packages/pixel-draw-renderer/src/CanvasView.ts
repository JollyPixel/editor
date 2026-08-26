// Import Third-party Dependencies
import { parseColor } from "@jolly-pixel/color";

// Import Internal Dependencies
import type { PixelDocument } from "./PixelDocument.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  OverlayLayer
} from "./rendering/overlays/OverlayLayer.ts";
import {
  PeerPresence
} from "./rendering/presence/PeerPresence.ts";
import {
  Viewport
} from "./rendering/Viewport.ts";
import type { ZoomOptions } from "./rendering/Zoom.ts";
import { clamp } from "./utils/math.ts";
import type {
  BrushHighlight,
  ByteColorInput,
  RGBA8,
  Vec2
} from "./types.ts";

export interface CanvasViewOptions {
  parent: HTMLDivElement;
  zoom?: ZoomOptions;
  /**
   * Outside color;
   * defaults to the parent's background or `#424242`.
   */
  background?: ByteColorInput;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  brushHighlight: BrushHighlight;
  /**
   * Explicit fill for a peer's vacated selection footprint.
   * @default null (dominant neighbor color)
   */
  eraseColor?: RGBA8 | null;
}

/**
 * Owns the canvas, overlays, and viewport camera.
 */
export class CanvasView {
  #doc: PixelDocument;
  #onRenderStateChanged = () => this.renderer.drawFrame();

  readonly viewport: Viewport;
  readonly renderer: CanvasRenderer;
  readonly overlays: OverlayLayer;
  readonly peerPresence: PeerPresence;

  constructor(
    doc: PixelDocument,
    options: CanvasViewOptions
  ) {
    this.#doc = doc;
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
      isOpaqueEnough(computedBackgroundColor)
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

    this.peerPresence = new PeerPresence({
      cursors: this.overlays.peerCursors,
      strokes: this.renderer.peerStrokes,
      uv: this.overlays.peerUvPreview,
      selectionOutlines: this.overlays.peerSelectionOutlines,
      floatingSelections: this.renderer.peerFloatingSelections
    });

    // These changes repaint without updating overlay geometry.
    doc.on("changed", this.#onRenderStateChanged);
    this.renderer.floatingSelection.on(
      "changed",
      this.#onRenderStateChanged
    );
    this.renderer.peerStrokes.on(
      "changed",
      this.#onRenderStateChanged
    );
    this.renderer.peerFloatingSelections.on(
      "changed",
      this.#onRenderStateChanged
    );
  }

  get backgroundColor(): string {
    return this.renderer.backgroundColor;
  }

  set backgroundColor(
    color: ByteColorInput
  ) {
    this.renderer.backgroundColor = color;
  }

  canvas(): HTMLCanvasElement {
    return this.renderer.canvas();
  }

  drawFrame(): void {
    this.renderer.drawFrame();
  }

  refresh(): void {
    this.renderer.drawFrame();
    this.overlays.refresh();
    this.peerPresence.refresh();
  }

  resize(
    width: number,
    height: number
  ): void {
    this.renderer.resize(width, height);
    this.overlays.resize(width, height);
    this.viewport.resizeCanvas(width, height);
  }

  centerTexture(): void {
    this.viewport.centerTexture();
  }

  reparentTo(
    newParentElement: HTMLDivElement
  ): void {
    this.renderer.reparentTo(newParentElement);
    this.overlays.reparentTo(newParentElement);
  }

  destroy(): void {
    this.#doc.off(
      "changed",
      this.#onRenderStateChanged
    );
    this.renderer.floatingSelection.off(
      "changed",
      this.#onRenderStateChanged
    );
    this.renderer.peerStrokes.off(
      "changed",
      this.#onRenderStateChanged
    );
    this.renderer.peerFloatingSelections.off(
      "changed",
      this.#onRenderStateChanged
    );

    const rendererCanvas = this.renderer.canvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.peerPresence.destroy();
    this.overlays.destroy();
  }

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

    // Keep the fitted texture clear of the container edges.
    const kFitPadding = 0.9;
    const fit = Math.min(
      containerSize.width / textureSize.x,
      containerSize.height / textureSize.y
    ) * kFitPadding;

    return clamp(Math.floor(fit), zoomMin, zoomMax);
  }
}

/**
 * Accepts inherited backgrounds unless unset or fully transparent.
 */
function isOpaqueEnough(
  color: string
): boolean {
  const parsed = parseColor(color);

  return parsed !== null && parsed.a > 0;
}
