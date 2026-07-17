// Import Third-party Dependencies
import Color from "colorjs.io";
import { fromUint8Array, toUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  BrushManager,
  type BrushManagerOptions
} from "./input/BrushManager.ts";
import {
  CanvasBuffer
} from "./buffer/CanvasBuffer.ts";
import {
  CanvasRenderer
} from "./rendering/CanvasRenderer.ts";
import {
  FillTool
} from "./input/FillTool.ts";
import {
  InputController,
  type WindowLike
} from "./input/InputController.ts";
import {
  LineTool,
  type LineCommitTrigger
} from "./input/LineTool.ts";
import {
  SelectTool
} from "./input/SelectTool.ts";
import {
  SvgManager
} from "./rendering/SvgManager.ts";
import {
  Viewport
} from "./rendering/Viewport.ts";
import { getColorAsRGBA, toRGBA } from "./colors.ts";
import type {
  Brush,
  ColorInput,
  DefaultViewport,
  Mode,
  RGBA,
  SelectionRect,
  Vec2
} from "./types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";

export type { Mode };

export interface CanvasManagerOptions {
  /**
   * Default interaction mode for the canvas.
   * "paint" for drawing, "move" for panning, or "fill" for the paint-bucket
   * flood-fill tool. If not specified, the default mode will be "paint".
   */
  defaultMode?: Mode;
  /**
   * Global event target used by InputController for drag-continuation
   * mouse tracking and keyboard/blur reporting.
   * @default window
   */
  window?: WindowLike;
  texture?: {
    defaultColor?: ColorInput;
    size?: {
      x: number;
      y?: number;
    };
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
  select?: {
    /**
     * Color used to fill the pixels vacated by a Delete or the source side
     * of a Move in "select" mode. Accepts a CSS color string or a colorjs.io
     * `Color` instance.
     * @default "#FFFFFF"
     */
    eraseColor?: ColorInput;
  };
  /**
   * Called after a draw stroke is committed to the master buffer.
   * Use this hook to synchronize the edited texture with an external consumer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for every local mutation (stroke, resize, texture replace).
   * Used by PixelSyncSession to forward mutations over the network.
   */
  onBufferUpdated?: PixelBufferHookListener;
}

export class CanvasManager {
  #parentHtmlElement: HTMLDivElement;
  #viewport: Viewport;
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #input: InputController;
  #svgManager: SvgManager;

  #onBufferUpdated?: PixelBufferHookListener;
  #onDrawEnd?: () => void;
  #isApplyingRemote = false;
  #strokeDirty = new Map<string, Vec2>();
  #strokeColor: RGBA | null = null;
  #isStrokeActive = false;
  #lineTool = new LineTool();
  #selectTool = new SelectTool();
  #eraseColor: RGBA;
  #lastCursorPos: Vec2 | null = null;
  #isShiftHeld = false;

  readonly brush: BrushManager;
  readonly viewport: DefaultViewport;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: CanvasManagerOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onBufferUpdated = options.onBufferUpdated;
    this.#onDrawEnd = options.onDrawEnd;
    this.#eraseColor = toRGBA(options.select?.eraseColor ?? "#FFFFFF");

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

    this.#canvasBuffer = new CanvasBuffer({
      size: textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize
    });

    if (options.texture?.init) {
      this.#canvasBuffer.setTexture(options.texture.init);
    }

    const computedBackgroundColor = getComputedStyle(parentHtmlElement).backgroundColor;
    const backgroundColor = computedBackgroundColor && new Color(computedBackgroundColor).alpha > 0
      ? computedBackgroundColor
      : "#555555";

    this.#renderer = new CanvasRenderer({
      viewport: this.#viewport,
      canvasBuffer: this.#canvasBuffer,
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
      window: options.window,
      actions: {
        onDrawStart: (tx, ty) => {
          if (this.#lineTool.isArmed && this.#lineTool.commitTrigger === "mousedown") {
            this.#commitArmedLine();

            return false;
          }

          this.#isStrokeActive = true;
          this.#drawColor(tx, ty);

          return true;
        },
        onDrawMove: (tx, ty) => {
          this.#drawColor(tx, ty);
        },
        onDrawEnd: () => {
          this.#endStroke();
        },
        onFillStart: (tx, ty) => {
          this.#fill(tx, ty);
        },
        onSelectStart: (tx, ty) => {
          this.#handleSelectStart({ x: tx, y: ty });
        },
        onSelectMove: (tx, ty) => {
          this.#handleSelectMove({ x: tx, y: ty });
        },
        onSelectEnd: () => {
          this.#handleSelectEnd();
        },
        onPanStart: (_mx, _my) => {
          // pan tracking is inside InputController
        },
        onPanMove: (dx, dy) => {
          this.#viewport.applyPan(dx, dy);
          this.#renderer.drawFrame();
          this.#refreshLinePreview();
          this.#refreshSelectionOverlay();
        },
        onPanEnd: () => {
          // nothing extra needed
        },
        onZoom: (delta, cx, cy) => {
          this.#viewport.applyZoom(delta, cx, cy);
          this.#renderer.drawFrame();
          this.#refreshLinePreview();
          this.#refreshSelectionOverlay();
        },
        onColorPick: (tx, ty) => {
          const [r, g, b, a] = this.#canvasBuffer.samplePixel(tx, ty);
          const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
          const opacity = a / 255;
          this.brush.setColor(hex, opacity);

          const event = new CustomEvent("colorpicked", {
            detail: { hex, opacity },
            bubbles: true,
            composed: true
          });
          this.#renderer.getCanvas().dispatchEvent(event);
        },
        onMouseMove: (cx, cy) => {
          if (cx < 0 || cy < 0) {
            this.#svgManager.updateBrushHighlight(null, null);
          }
          else if (this.#input.getMode() === "paint") {
            this.#svgManager.updateBrushHighlight(cx, cy);
          }
        },
        onCursorMove: (pos) => {
          this.#lastCursorPos = pos;
          if (this.#lineTool.isArmed && pos) {
            this.#lineTool.update(pos);
            this.#refreshLinePreview();
          }
        },
        onMouseUp: () => {
          if (this.#lineTool.isArmed && this.#lineTool.commitTrigger === "mouseup") {
            this.#commitArmedLine();
          }
        },
        onShiftDown: () => {
          this.#isShiftHeld = true;
          if (this.#input.getMode() !== "paint") {
            return;
          }

          if (this.#isStrokeActive) {
            // Mouse button already held: no future mousedown to commit on,
            // so the line commits on the eventual mouseup instead.
            this.#input.stopDrawing();
            this.#endStroke();
            this.#armLine("mouseup");

            return;
          }

          this.#armLine("mousedown");
        },
        onShiftUp: () => {
          this.#isShiftHeld = false;
          this.#cancelLineIfArmed();
        },
        onBlur: () => {
          this.#isShiftHeld = false;
          this.#cancelLineIfArmed();
        },
        onCopy: () => this.#handleCopy(),
        onPaste: () => this.#handlePaste(),
        onDelete: () => this.#handleDelete()
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
      this.#cancelLineIfArmed();
    }
    if (mode !== "select") {
      this.#clearSelection();
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
    return this.#canvasBuffer.getSize();
  }

  setTextureSize(
    size: Vec2
  ): void {
    if (size.x <= 0 || size.y <= 0) {
      console.error("CanvasManager: Texture size must be positive");

      return;
    }

    this.#canvasBuffer.setSize(size);
    this.#viewport.setTextureSize(size);
    this.#svgManager.setTextureSize(size);
    this.#renderer.drawFrame();

    this.#emitHook({
      action: "resized",
      metadata: {
        size: structuredClone(size)
      }
    });
  }

  getCamera(): Vec2 {
    return { ...this.#viewport.camera };
  }

  getZoom(): number {
    return this.#viewport.zoom;
  }

  getZoomSensitivity(): number {
    return this.#viewport.zoomSensitivity;
  }

  setZoomSensitivity(
    sensitivity: number
  ): void {
    this.#viewport.setZoomSensitivity(sensitivity);
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
    this.#viewport.resizeCanvas(bounds.width, bounds.height);
    this.#svgManager.updateSvgSize(bounds.width, bounds.height);
    this.#renderer.drawFrame();
  }

  getTextureCanvas(): HTMLCanvasElement {
    return this.#canvasBuffer.getCanvas();
  }

  /**
   * The interactive (on-screen) canvas InputController listens on. Useful
   * for attaching additional event listeners or overlays.
   */
  getCanvas(): HTMLCanvasElement {
    return this.#renderer.getCanvas();
  }

  destroy(): void {
    this.#input.destroy();
    const rendererCanvas = this.#renderer.getCanvas();
    if (rendererCanvas.parentElement) {
      rendererCanvas.remove();
    }
    this.#svgManager.destroy();
  }

  setTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#canvasBuffer.setTexture(source);
    const size = this.#canvasBuffer.getSize();
    this.#viewport.setTextureSize(size);
    this.#renderer.drawFrame();

    this.#emitHook({
      action: "texture-replaced",
      metadata: {
        size,
        pixels: fromUint8Array(new Uint8Array(this.#canvasBuffer.getPixels()))
      }
    });
  }

  getTexture(): Uint8ClampedArray {
    return this.#canvasBuffer.getPixels();
  }

  /**
   * Commits an already-computed pixel set as a single atomic edit (one draw
   * call, one "stroke" hook emission). Used by the Shift-to-line tool (to
   * avoid redrawing the canvas once per rasterized point) and the fill tool
   * (to commit a flood-filled region in one shot).
   */
  commitPixels(
    pixels: Vec2[]
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const [r, g, b, a] = getColorAsRGBA(this.brush.getColor());
    const color: RGBA = { r, g, b, a };

    this.#canvasBuffer.drawPixels(pixels, color);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();

    this.#emitHook({
      action: "stroke",
      metadata: {
        color,
        positions: pixels
      }
    });
    this.#onDrawEnd?.();
  }

  /**
   * Replace the settable hook after construction. Used by PixelSyncSession
   * to attach itself to an already-constructed CanvasManager.
   */
  set onBufferUpdated(fn: PixelBufferHookListener | undefined) {
    this.#onBufferUpdated = fn;
  }

  /**
   * Applies a mutation received from a remote peer without re-emitting the
   * onBufferUpdated hook, preventing an echo loop back to the network.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#isApplyingRemote = true;
    try {
      switch (event.action) {
        case "stroke":
          this.#canvasBuffer.drawPixels(event.metadata.positions, event.metadata.color);
          this.#canvasBuffer.copyToMaster();
          this.#renderer.drawFrame();
          break;

        case "resized":
          this.setTextureSize(event.metadata.size);
          break;

        case "texture-replaced":
          this.#applyPixelReplace(event.metadata.size, new Uint8ClampedArray(toUint8Array(event.metadata.pixels)));
          break;
      }
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  /**
   * Hydrates the buffer from a network snapshot (join flow). Unlike
   * applyRemoteCommand, this is never itself broadcast as a command.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#isApplyingRemote = true;
    try {
      this.#applyPixelReplace(size, pixels);
    }
    finally {
      this.#isApplyingRemote = false;
    }
  }

  #applyPixelReplace(
    size: Vec2,
    pixels: Uint8ClampedArray
  ): void {
    this.#canvasBuffer.setPixels(pixels, size);
    this.#viewport.setTextureSize(size);
    this.#svgManager.setTextureSize(size);
    this.#renderer.drawFrame();
  }

  #emitHook(
    event: PixelBufferHookEvent
  ): void {
    if (this.#isApplyingRemote || !this.#onBufferUpdated) {
      return;
    }

    this.#onBufferUpdated(event);
  }

  #commitStroke(): void {
    if (this.#strokeDirty.size === 0 || this.#strokeColor === null) {
      this.#strokeDirty.clear();
      this.#strokeColor = null;

      return;
    }

    const positions = [...this.#strokeDirty.values()];
    const color = this.#strokeColor;
    this.#strokeDirty.clear();
    this.#strokeColor = null;

    this.#emitHook({
      action: "stroke",
      metadata: {
        color,
        positions
      }
    });
  }

  #endStroke(): void {
    this.#canvasBuffer.copyToMaster();
    this.#commitStroke();
    this.#isStrokeActive = false;
    this.#onDrawEnd?.();
  }

  /**
   * Expands raw rasterized line points into brush-stamped, deduplicated
   * texture pixels (LineTool has no brush awareness).
   */
  #stampLinePixels(
    points: Vec2[]
  ): Vec2[] {
    const stamped = new Map<string, Vec2>();
    for (const point of points) {
      for (const pixel of this.brush.getAffectedPixels(point.x, point.y)) {
        stamped.set(`${pixel.x},${pixel.y}`, pixel);
      }
    }

    return [...stamped.values()];
  }

  #armLine(
    commitTrigger: LineCommitTrigger
  ): void {
    if (!this.#lastCursorPos) {
      return;
    }

    this.#lineTool.arm(this.#lastCursorPos, commitTrigger);
    this.#refreshLinePreview();
  }

  /**
   * Commits the armed segment. If Shift is still held afterwards, immediately
   * re-arms from the just-committed endpoint (commitTrigger "mousedown") so
   * the next click continues a connected polyline instead of requiring the
   * user to release and re-press Shift to resume line drawing.
   */
  #commitArmedLine(): void {
    const points = this.#lineTool.commit();
    this.#svgManager.clearPreviewLine();
    if (points) {
      this.commitPixels(this.#stampLinePixels(points));

      if (this.#isShiftHeld) {
        this.#lineTool.arm(points.at(-1) ?? points[0], "mousedown");
        this.#refreshLinePreview();
      }
    }
  }

  #cancelLineIfArmed(): void {
    if (!this.#lineTool.isArmed) {
      return;
    }

    this.#lineTool.cancel();
    this.#svgManager.clearPreviewLine();
  }

  #refreshLinePreview(): void {
    if (!this.#lineTool.isArmed) {
      return;
    }

    const points = this.#lineTool.getPreviewPoints() ?? [];
    if (points.length > 0) {
      this.#svgManager.setPreviewLine(
        points[0],
        points.at(-1) ?? points[0]
      );
    }
  }

  /**
   * Flood-fills the connected region of same-colored pixels reachable from
   * (tx, ty) with the current brush color/opacity, committed as a single
   * atomic edit. No-ops when the target position is out of bounds or already
   * matches the fill color (see FillTool.floodFill).
   */
  #fill(
    tx: number,
    ty: number
  ): void {
    const [r, g, b, a] = getColorAsRGBA(this.brush.getColor());
    const fillColor: RGBA = { r, g, b, a };

    const positions = FillTool.floodFill(this.#canvasBuffer, { x: tx, y: ty }, fillColor);
    this.commitPixels(positions);
  }

  #drawColor(
    tx: number,
    ty: number,
    color?: ColorInput
  ): void {
    const pixelColor = color ?? this.brush.getColor();
    const [r, g, b, a] = getColorAsRGBA(pixelColor);

    const pixels = this.brush.getAffectedPixels(tx, ty);
    this.#canvasBuffer.drawPixels(pixels, { r, g, b, a });
    this.#renderer.drawFrame();

    this.#strokeColor ??= { r, g, b, a };
    for (const pixel of pixels) {
      this.#strokeDirty.set(`${pixel.x},${pixel.y}`, pixel);
    }
  }

  /**
   * Left mousedown in "select" mode: grabs the existing selection to move it
   * when `pos` falls inside it, otherwise discards any prior selection and
   * starts dragging out a new rectangle.
   */
  #handleSelectStart(
    pos: Vec2
  ): void {
    if (this.#selectTool.state === "selected" && this.#selectTool.hitTest(pos)) {
      this.#selectTool.startMove(pos);

      const rect = this.#selectTool.rect;
      const snapshot = this.#selectTool.snapshot;
      if (rect && snapshot) {
        this.#renderer.setFloatingOverlay({
          sourceRect: rect,
          pixels: snapshot,
          eraseColor: this.#eraseColor,
          blankSource: !this.#selectTool.willSkipErase
        });
        this.#renderer.drawFrame();
      }

      return;
    }

    this.#clearSelection();
    const rect = this.#selectTool.startCreate(pos);
    this.#svgManager.setSelectionRect(rect);
  }

  #handleSelectMove(
    pos: Vec2
  ): void {
    if (this.#selectTool.state === "creating") {
      const rect = this.#selectTool.updateCreate(pos);
      if (rect) {
        this.#svgManager.setSelectionRect(rect);
      }

      return;
    }

    if (this.#selectTool.state === "moving") {
      const rect = this.#selectTool.updateMove(pos);
      if (rect) {
        this.#svgManager.setSelectionRect(rect);
        this.#renderer.updateFloatingOverlayPosition(rect);
        this.#renderer.drawFrame();
      }
    }
  }

  #handleSelectEnd(): void {
    if (this.#selectTool.state === "creating") {
      const rect = this.#selectTool.rect;
      if (rect) {
        const snapshot = SelectTool.captureSnapshot(this.#canvasBuffer, rect);
        this.#selectTool.finishCreate(snapshot);
      }

      return;
    }

    if (this.#selectTool.state === "moving") {
      const snapshot = this.#selectTool.snapshot;
      const result = this.#selectTool.finishMove();
      this.#renderer.clearFloatingOverlay();

      if (result && snapshot) {
        if (!result.skipErase) {
          this.#eraseRegion(result.source);
        }
        this.#paintRegion(result.dest, snapshot);
      }

      const rect = this.#selectTool.rect;
      if (rect) {
        this.#svgManager.setSelectionRect(rect);
      }
    }
  }

  /**
   * Ctrl/Cmd+C: snapshots the active selection into SelectTool's clipboard.
   * No-op (returns false, letting the browser's default copy proceed)
   * unless a selection is currently active.
   */
  #handleCopy(): boolean {
    if (this.#selectTool.state !== "selected") {
      return false;
    }

    this.#selectTool.copy();

    return true;
  }

  /**
   * Ctrl/Cmd+V: stamps the clipboard snapshot back onto the buffer at the
   * exact position it was copied from, and makes it the new active
   * selection so the next drag relocates the duplicate.
   */
  #handlePaste(): boolean {
    const result = this.#selectTool.paste();
    if (!result) {
      return false;
    }

    this.#paintRegion(result.rect, result.pixels);
    this.#svgManager.setSelectionRect(result.rect);

    return true;
  }

  /**
   * Delete key: fills the active selection with the configured erase color.
   * The selection stays active, now over blanked pixels.
   */
  #handleDelete(): boolean {
    if (this.#selectTool.state !== "selected") {
      return false;
    }

    const rect = this.#selectTool.rect;
    if (!rect) {
      return false;
    }

    this.#eraseRegion(rect);
    this.#selectTool.markErased(this.#eraseColor);

    return true;
  }

  #clearSelection(): void {
    this.#selectTool.clear();
    this.#svgManager.clearSelectionRect();
    this.#renderer.clearFloatingOverlay();
  }

  #refreshSelectionOverlay(): void {
    const rect = this.#selectTool.rect;
    if (rect) {
      this.#svgManager.setSelectionRect(rect);
    }
  }

  /**
   * Fills every position in `rect` with the configured erase color. Used to
   * vacate a Delete'd or moved-away-from selection. Out-of-bounds positions
   * are silently clipped by CanvasBuffer.drawPixels, same as every other
   * paint path in this class.
   */
  #eraseRegion(
    rect: SelectionRect
  ): void {
    const positions: Vec2[] = [];
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        positions.push({ x: rect.x + x, y: rect.y + y });
      }
    }

    this.#canvasBuffer.drawPixels(positions, this.#eraseColor);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
    this.#onDrawEnd?.();
  }

  /**
   * Plain-overwrites `rect` with `pixels` (multi-colored, unlike
   * #eraseRegion's uniform fill) — the commit step for a Move's destination
   * or a Duplicate paste.
   */
  #paintRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    this.#canvasBuffer.drawRegion(rect, pixels);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
    this.#onDrawEnd?.();
  }
}
