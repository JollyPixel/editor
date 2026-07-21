// Import Internal Dependencies
import {
  Brush,
  type BrushColorSlot,
  type BrushOptions
} from "./tools/Brush.ts";
import {
  Tools,
  type Toolset
} from "./tools/Tools.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import {
  InteractionRouter
} from "./input/InteractionRouter.ts";
import { PaintMode } from "./input/modes/PaintMode.ts";
import { FillMode } from "./input/modes/FillMode.ts";
import { SelectMode } from "./input/modes/SelectMode.ts";
import { UVMode } from "./input/modes/UVMode.ts";
import { MoveMode } from "./input/modes/MoveMode.ts";
import {
  InputController,
  type WindowLike
} from "./input/InputController.ts";
import type {
  Keybindings,
  KeybindingsMap
} from "./input/Keybindings.ts";
import type {
  DefaultViewport
} from "./rendering/Viewport.ts";
import type {
  Zoom,
  ZoomOptions
} from "./rendering/Zoom.ts";
import {
  EditPipeline
} from "./sync/EditPipeline.ts";
import {
  PixelDocument
} from "./PixelDocument.ts";
import {
  CanvasView
} from "./CanvasView.ts";
import type { UVMap } from "./uv/UVMap.ts";
import type { UVRegion } from "./uv/UVRegion.ts";
import { toRGBA } from "./utils/colors.ts";
import type {
  BrushHighlight,
  ColorInput,
  Mode,
  Vec2
} from "./types.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";

export type { Mode };
export type { HistoryState };

export interface PixelArtCanvasOptions {
  /**
  * Initial interaction mode: `paint`, `move`, `fill`, or `select`.
  * @default "paint"
   */
  defaultMode?: Mode;
  /**
  * Global event target for drag continuation, keyboard, and blur events.
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
  /**
   * When `zoom.default` is omitted, it's computed to fit the whole texture
   * inside the container's initial size instead of `Zoom`'s own flat
   * default of 4 — a large texture in a small container no longer starts
   * zoomed in past what's visible. Pass an explicit `default` to opt out.
   */
  zoom?: ZoomOptions;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  /**
    * Canvas color outside texture bounds.
   */
  backgroundColor?: ColorInput;
  brush?: BrushOptions;
  select?: {
    /**
     * Explicit fill for deleted pixels and vacated selection footprints
     * (Move/Rotate/Flip), overriding the smart default. When omitted, the
     * vacated area is instead filled with the most common color among its
     * neighbors — so it blends into the surrounding artwork — falling
     * back to fully transparent when there are no in-bounds neighbors.
     * @default dominant neighbor color, transparent as the ultimate fallback
     */
    eraseColor?: ColorInput;
  };
  /**
   * Called after a local edit is committed to the master buffer.
   */
  onDrawEnd?: () => void;
  /**
   * Called for local strokes, resizes, and texture replacements.
   */
  onBufferUpdated?: PixelBufferHookListener;
  /**
   * History settings. If omitted, history is disabled.
   */
  history?: {
    enabled?: boolean;
    /**
     * @default 10
     */
    limit?: number;
  };
  onHistoryChange?: (state: HistoryState) => void;
  /**
   * Keybinding overrides.
   */
  keybindings?: Partial<KeybindingsMap>;
}

export class PixelArtCanvas {
  #parentHtmlElement: HTMLDivElement;
  #doc: PixelDocument;
  #view: CanvasView;
  #input: InputController;

  #edits: EditPipeline;
  #onDrawEnd?: () => void;
  #router: InteractionRouter;
  #tools: Tools;

  readonly brush: Brush;
  readonly viewport: DefaultViewport;
  readonly uv: UVMap;
  /** Public view of the drawing tools: `tools.brush`, `tools.fill`, `tools.select`. */
  readonly tools: Toolset;

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onDrawEnd = options.onDrawEnd;
    const defaultMode: Mode = options.defaultMode ?? "paint";
    const eraseColor = options.select?.eraseColor === undefined ?
      null :
      toRGBA(options.select.eraseColor);

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.#doc = new PixelDocument({
      size: textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize,
      init: options.texture?.init,
      history: {
        enabled: options.history?.enabled,
        limit: options.history?.limit,
        onChange: options.onHistoryChange
      }
    });
    this.uv = this.#doc.uv;

    this.brush = new Brush(options.brush);

    const brushRef = this.brush;
    const self = this;

    const brushAdapter: BrushHighlight = {
      get size() {
        return self.#router.highlightBrushSize(brushRef.size);
      },
      get colorInline() {
        return brushRef.colorInline;
      },
      get colorOutline() {
        return brushRef.colorOutline;
      }
    };

    this.#view = new CanvasView(this.#doc, {
      parent: parentHtmlElement,
      zoom: options.zoom,
      background: options.backgroundColor,
      backgroundTransparency: options.backgroundTransparency,
      brushHighlight: brushAdapter
    });
    this.viewport = this.#view.viewport;

    this.#edits = new EditPipeline({
      brush: this.brush,
      canvasBuffer: this.#doc.buffer,
      viewport: this.#view.viewport,
      renderer: this.#view.renderer,
      history: this.#doc.history,
      uvMap: this.#doc.uv,
      onBufferUpdated: options.onBufferUpdated,
      onDrawEnd: options.onDrawEnd
    });

    this.#tools = new Tools({
      brush: this.brush,
      canvasBuffer: this.#doc.buffer,
      renderer: this.#view.renderer,
      linePreview: this.#view.overlays.linePreview,
      selectionOverlay: this.#view.overlays.selection,
      eraseColor,
      uvMap: this.#doc.uv,
      uvOverlay: this.#view.overlays.uvOverlay,
      pipeline: this.#edits
    });
    this.tools = this.#tools;

    // Camera changes (pan / zoom / canvas-resize / center) repaint the canvas
    // and re-place every camera-dependent overlay. One subscriber replaces the
    // three identical blocks previously copied across onResize/onPanMove/onZoom.
    this.#view.viewport.on("changed", () => {
      this.#view.drawFrame();
      this.#tools.line.refreshPreview();
      this.#tools.select.refreshOverlay();
      this.#view.overlays.uvOverlay.refresh();
    });

    this.#router = new InteractionRouter({
      defaultMode,
      viewport: this.#view.viewport,
      setCursor: (cursor) => {
        this.#view.renderer.cursor = cursor;
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      modes: [
        new PaintMode({
          brush: this.#tools.brush,
          line: this.#tools.line,
          highlight: this.#view.overlays.brushHighlight,
          stopDrawing: () => this.#input.stopDrawing()
        }),
        new FillMode({
          fill: this.#tools.fill,
          highlight: this.#view.overlays.brushHighlight
        }),
        new SelectMode({ select: this.#tools.select }),
        new UVMode({ uv: this.#tools.uv }),
        new MoveMode()
      ]
    });

    this.#input = new InputController({
      canvas: this.#view.renderer.canvas(),
      viewport: this.#view.viewport,
      window: options.window,
      actions: this.#router,
      keybindings: options.keybindings
    });

    this.centerTexture();
  }

  get mode(): Mode {
    return this.#router.mode;
  }

  set mode(
    mode: Mode
  ) {
    this.#router.mode = mode;
  }

  /**
   * Canvas color outside texture bounds.
   */
  get backgroundColor(): string {
    return this.#view.backgroundColor;
  }

  set backgroundColor(
    color: ColorInput
  ) {
    this.#view.backgroundColor = color;
  }

  get parentHtmlElement(): HTMLDivElement {
    return this.#parentHtmlElement;
  }

  reparentCanvasTo(
    newParentElement: HTMLDivElement
  ): void {
    if (!newParentElement) {
      console.error("PixelArtCanvas: Invalid parent element");

      return;
    }

    this.#view.reparentTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  get textureSize(): Vec2 {
    return this.#doc.buffer.size();
  }

  set textureSize(
    size: Vec2
  ) {
    if (
      size.x <= 0 ||
      size.y <= 0
    ) {
      console.error("PixelArtCanvas: Texture size must be positive");

      return;
    }

    this.#edits.resize(size);
  }

  get camera(): Vec2 {
    return { ...this.#view.viewport.camera };
  }

  get zoom(): Zoom {
    return this.#view.viewport.zoom;
  }

  get keybindings(): Keybindings {
    return this.#input.keybindings;
  }

  centerTexture(): void {
    this.#view.centerTexture();
  }

  onResize(): void {
    const bounds = this.#parentHtmlElement.getBoundingClientRect();

    if (
      bounds.width === 0 ||
      bounds.height === 0
    ) {
      return;
    }

    // view.resize() ends by resizing the viewport, whose "changed" signal
    // repaints and re-places the camera-dependent overlays.
    this.#view.resize(bounds.width, bounds.height);
  }

  textureCanvas(): HTMLCanvasElement {
    return this.#doc.buffer.canvas();
  }

  canvas(): HTMLCanvasElement {
    return this.#view.canvas();
  }

  destroy(): void {
    this.#input.destroy();
    this.#view.destroy();
  }

  set texture(
    source: HTMLCanvasElement | HTMLImageElement
  ) {
    this.#edits.replaceTexture(source);
  }

  get texture(): Uint8ClampedArray {
    return this.#doc.buffer.pixels();
  }

  /**
   * Commits pixels as a stroke edit.
   */
  commitPixels(
    pixels: Vec2[],
    slot: BrushColorSlot = "primary"
  ): void {
    this.#edits.commitPixels(pixels, slot);
  }

  /**
    * Reverts the latest local edit.
    */
  undo(): boolean {
    const entry = this.#edits.runHistoryReplay(() => this.#doc.history.undo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (entry.action === "select-edit" && this.#router.mode === "select") {
      this.#tools.select.syncSelectionAfterHistory(
        entry.oldRect,
        entry.oldMask
      );
    }
    for (const event of History.buildUndoReplayEvents(entry)) {
      this.#edits.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  /**
    * Reapplies the latest reverted edit.
    */
  redo(): boolean {
    const entry = this.#edits.runHistoryReplay(() => this.#doc.history.redo());
    if (!entry) {
      return false;
    }

    this.#refreshAfterHistoryApply();
    if (
      entry.action === "select-edit" &&
      this.#router.mode === "select"
    ) {
      this.#tools.select.syncSelectionAfterHistory(
        entry.newRect,
        entry.newMask
      );
    }
    for (const event of History.buildRedoReplayEvents(entry)) {
      this.#edits.emitHook(event);
    }
    this.#onDrawEnd?.();

    return true;
  }

  canUndo(): boolean {
    return this.#doc.history.canUndo;
  }

  canRedo(): boolean {
    return this.#doc.history.canRedo;
  }

  /**
   * Replaces the local buffer-mutation listener.
   */
  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#edits.onBufferUpdated = fn;
  }

  /**
   * Applies a remote mutation without emitting it.
   */
  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#edits.applyRemoteCommand(event);
  }

  /**
   * Replaces the buffer from a remote snapshot.
   */
  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: UVRegion[] = []
  ): void {
    this.#edits.loadSnapshot(size, pixels, uvRegions);
  }

  #refreshAfterHistoryApply(): void {
    this.#view.viewport.texture.resize(
      this.#doc.buffer.size()
    );
    this.#view.drawFrame();
  }
}
