// Import Third-party Dependencies
import type { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  Brush,
  type BrushOptions,
  type BrushPaintSource
} from "./tools/Brush.ts";
import {
  Tools,
  type Toolset
} from "./tools/Tools.ts";
import type { SelectEngineEvent } from "./tools/SelectEngine.events.ts";
import type { SelectionPresence } from "./selection/SelectionPresence.ts";
import {
  CanvasHistory,
  type PixelArtCanvasHistory,
  type PixelHistoryState
} from "./history/CanvasHistory.ts";
import type { SelectionFootprint } from "./selection/SelectionFootprint.ts";
import {
  InteractionRouter,
  type ExternalCursorMoveListener
} from "./input/InteractionRouter.ts";
import { PaintMode } from "./input/modes/PaintMode.ts";
import { StrokeMode } from "./input/modes/StrokeMode.ts";
import { FillMode } from "./input/modes/FillMode.ts";
import { SelectMode } from "./input/modes/SelectMode.ts";
import { UVMode } from "./input/modes/UVMode.ts";
import { MoveMode } from "./input/modes/MoveMode.ts";
import { PointerController } from "./input/PointerController.ts";
import { Shortcuts } from "./input/Shortcuts.ts";
import type { CanvasShortcuts } from "./input/CanvasShortcuts.ts";
import type { WindowLike } from "./input/WindowLike.ts";
import type {
  CanvasViewport
} from "./rendering/Viewport.ts";
import type {
  Zoom,
  ZoomOptions
} from "./rendering/Zoom.ts";
import {
  PixelDocument
} from "./PixelDocument.ts";
import {
  CanvasView
} from "./CanvasView.ts";
import type { UVMap } from "./uv/map/UVMap.ts";
import {
  uvSlotGeometries,
  uvSlotMask
} from "./uv/region/uvSlotMask.ts";
import type { UVGeometry } from "./uv/geometry/types.ts";
import type { PeerPresence } from "./rendering/presence/PeerPresence.ts";
import { resolveColor } from "./utils/colors.ts";
import { SelectionEraseColor } from "./selection/SelectionEraseColor.ts";
import type {
  ByteColorInput,
  Mode,
  PeerStrokePixel,
  TextureView,
  Vec2
} from "./types.ts";
import { ClipboardController } from "./clipboard/ClipboardController.ts";
import type {
  ClipboardAdapter,
  ClipboardOperationResult
} from "./clipboard/types.ts";

export type { Mode };
export type { TextureView };

export interface ClearTextureOptions {
  includeUV?: boolean;
}

export interface PixelArtCanvasOptions {
  document?: PixelDocument;
  defaultMode?: Mode;
  window?: WindowLike;
  texture?: {
    defaultColor?: ByteColorInput;
    size?: {
      x: number;
      y?: number;
    };
    maxSize?: number;
    init?: HTMLCanvasElement;
  };
  zoom?: ZoomOptions;
  backgroundTransparency?: {
    colors: { odd: string; even: string; };
    squareSize: number;
  };
  backgroundColor?: ByteColorInput;
  brush?: BrushOptions;
  select?: {
    eraseColor?: ByteColorInput;
    sizeLabel?: boolean;
  };
  uv?: {
    deselectOnEmptyClick?: boolean;
    resizable?: boolean;
  };
  onDrawEnd?: () => void;
  history?: PixelArtCanvasHistory;
  onHistoryChange?: (state: PixelHistoryState) => void;
  clipboard?: ClipboardAdapter | null;
  onClipboardResult?: (result: ClipboardOperationResult) => void;
  onModeChange?: (mode: Mode, previousMode: Mode) => void;
}

export class PixelArtCanvas {
  #parentHtmlElement: HTMLDivElement;
  #view: CanvasView;
  #input: PointerController;

  #onDrawEnd?: () => void;
  #history: CanvasHistory;
  #onStrokeProgress?: (pixels: PeerStrokePixel[]) => void;
  #router: InteractionRouter;
  #tools: Tools;
  #clipboard: ClipboardController;
  #onDocumentDrawEnd = () => this.#onDrawEnd?.();
  #onTextureReplaced = () => {
    this.#tools.select.discard();
    this.#tools.line.reset();
  };
  #onViewportChanged = () => {
    this.#view.refresh();
    this.#tools.line.refreshPreview();
    this.#tools.select.refreshOverlay();
  };

  readonly document: PixelDocument;
  readonly brush: Brush;
  readonly viewport: CanvasViewport;
  readonly uv: UVMap;
  readonly tools: Toolset;
  readonly shortcuts: CanvasShortcuts;
  readonly peerPresence: PeerPresence;
  readonly selectionEvents: Pick<Emitter<SelectEngineEvent>, "on" | "off">;

  get selectionPresence(): SelectionPresence | null {
    return this.#tools.select.presence;
  }

  constructor(
    parentHtmlElement: HTMLDivElement,
    options: PixelArtCanvasOptions = {}
  ) {
    this.#parentHtmlElement = parentHtmlElement;
    this.#onDrawEnd = options.onDrawEnd;
    const defaultMode: Mode = options.defaultMode ?? "paint";
    const eraseColor = new SelectionEraseColor(
      options.select?.eraseColor === undefined ?
        null :
        resolveColor(options.select.eraseColor)
    );

    const textureSize: Vec2 = options.texture?.size
      ? { x: options.texture.size.x, y: options.texture.size.y ?? options.texture.size.x }
      : { x: 64, y: 32 };

    this.document = options.document ?? new PixelDocument({
      size: textureSize,
      defaultColor: options.texture?.defaultColor,
      maxSize: options.texture?.maxSize,
      init: options.texture?.init
    });
    this.uv = this.document.uv;
    this.#history = new CanvasHistory({
      document: this.document,
      history: options.history,
      restoreSelection: (footprint) => this.#restoreSelection(footprint),
      onChange: options.onHistoryChange
    });

    this.brush = new Brush(options.brush);

    this.#view = new CanvasView(this.document, {
      parent: parentHtmlElement,
      zoom: options.zoom,
      background: options.backgroundColor,
      backgroundTransparency: options.backgroundTransparency,
      brushHighlight: this.brush,
      eraseColor,
      selectionSizeLabel: options.select?.sizeLabel
    });
    this.viewport = this.#view.viewport;
    this.peerPresence = this.#view.peerPresence;

    this.#tools = new Tools({
      brush: this.brush,
      document: this.document,
      renderer: this.#view.renderer,
      linePreview: this.#view.overlays.linePreview,
      selectionOverlay: this.#view.overlays.selection,
      eraseColor,
      uvOverlay: this.#view.overlays.uvOverlay,
      uvDeselectOnEmptyClick: options.uv?.deselectOnEmptyClick,
      uvResizable: options.uv?.resizable,
      viewport: this.#view.viewport,
      onProgress: (pixels) => this.#onStrokeProgress?.(pixels),
      paintSelectionEdit: (edit) => this.#history.recordSelectionEdit(
        { before: edit.before, after: edit.after },
        () => this.document.paintSelectionEdit(edit)
      )
    });
    this.tools = this.#tools;
    this.selectionEvents = this.#tools.select;

    this.#view.viewport.on("changed", this.#onViewportChanged);
    this.document.on("draw-end", this.#onDocumentDrawEnd);
    this.document.on("resized", this.#onTextureReplaced);
    this.document.on("replaced", this.#onTextureReplaced);

    const strokeTools = {
      brush: this.brush,
      engine: this.#tools.brush,
      line: this.#tools.line,
      highlight: this.#view.overlays.brushHighlight
    };
    this.#router = new InteractionRouter({
      defaultMode,
      setCursor: (cursor) => {
        this.#view.renderer.cursor = cursor;
      },
      onModeChange: options.onModeChange,
      modes: [
        new PaintMode(strokeTools),
        new StrokeMode({
          ...strokeTools,
          id: "erase",
          erase: true
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

    this.#clipboard = new ClipboardController({
      adapter: options.clipboard,
      select: this.#tools.select,
      router: this.#router,
      viewport: this.#view.viewport,
      buffer: this.document.buffer,
      onResult: options.onClipboardResult
    });
    this.shortcuts = new Shortcuts({
      router: this.#router,
      clipboard: this.#clipboard,
      history: this
    });
    this.#input = new PointerController({
      canvas: this.#view.renderer.canvas(),
      viewport: this.#view.viewport,
      window: options.window,
      actions: this.#router
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

  get textureView(): TextureView {
    return this.#view.textureView;
  }

  set textureView(
    view: TextureView
  ) {
    if (view === this.#view.textureView) {
      return;
    }

    this.#view.textureView = view;
    const readOnly = view === "normal";
    this.#tools.select.readOnly = readOnly;
    this.#router.pixelsReadOnly = readOnly;
  }

  get pixelsReadOnly(): boolean {
    return this.#router.pixelsReadOnly;
  }

  get unavailableModes(): ReadonlySet<Mode> {
    return this.#router.unavailableModes;
  }

  get backgroundColor(): string {
    return this.#view.backgroundColor;
  }

  set backgroundColor(
    color: ByteColorInput
  ) {
    this.#view.backgroundColor = color;
  }

  get parentHtmlElement(): HTMLDivElement {
    return this.#parentHtmlElement;
  }

  reparentCanvasTo(
    newParentElement: HTMLDivElement
  ): void {
    this.#view.reparentTo(newParentElement);
    this.#parentHtmlElement = newParentElement;
    this.onResize();
  }

  get textureSize(): Vec2 {
    return this.document.buffer.size();
  }

  set textureSize(
    size: Vec2
  ) {
    this.document.resize(size);
  }

  get maxTextureSize(): number {
    return this.document.buffer.maxSize;
  }

  get camera(): Vec2 {
    return { ...this.#view.viewport.camera };
  }

  get zoom(): Zoom {
    return this.#view.viewport.zoom;
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

    this.#view.resize(bounds.width, bounds.height);
  }

  textureCanvas(): HTMLCanvasElement {
    return this.document.buffer.canvas();
  }

  hasTransparency(
    geometry: UVGeometry
  ): boolean {
    return this.document.hasTransparency(geometry);
  }

  canvas(): HTMLCanvasElement {
    return this.#view.canvas();
  }

  destroy(): void {
    this.#input.destroy();
    this.#view.viewport.off("changed", this.#onViewportChanged);
    this.document.off("draw-end", this.#onDocumentDrawEnd);
    this.document.off("resized", this.#onTextureReplaced);
    this.document.off("replaced", this.#onTextureReplaced);
    this.#view.destroy();
    this.#history.destroy();
  }

  set texture(
    source: HTMLCanvasElement | HTMLImageElement
  ) {
    this.document.replaceTexture(source);
  }

  get texture(): Uint8ClampedArray {
    return this.document.buffer.pixels();
  }

  clearTexture(
    options: ClearTextureOptions = {}
  ): void {
    const keepMask = options.includeUV ?
      undefined :
      uvSlotMask(
        uvSlotGeometries(this.uv.regions),
        this.textureSize
      );

    this.document.clearTexture(keepMask);
  }

  commitPixels(
    pixels: Vec2[],
    source: BrushPaintSource = "primary"
  ): void {
    this.document.paintPixels(pixels, this.brush.colorFor(source));
  }

  undo(): boolean {
    return this.#history.undo();
  }

  redo(): boolean {
    return this.#history.redo();
  }

  #restoreSelection(
    footprint: SelectionFootprint
  ): void {
    if (this.#router.mode === "select") {
      this.#tools.select.syncSelectionAfterHistory(footprint);
    }
  }

  canUndo(): boolean {
    return this.#history.state.canUndo;
  }

  canRedo(): boolean {
    return this.#history.state.canRedo;
  }

  undoDepth(): number {
    return this.#history.state.undoCount;
  }

  redoDepth(): number {
    return this.#history.state.redoCount;
  }

  get onCursorMove(): ExternalCursorMoveListener | undefined {
    return this.#router.onExternalCursorMove;
  }

  set onCursorMove(
    fn: ExternalCursorMoveListener | undefined
  ) {
    this.#router.onExternalCursorMove = fn;
  }

  get onStrokeProgress(): ((pixels: PeerStrokePixel[]) => void) | undefined {
    return this.#onStrokeProgress;
  }

  set onStrokeProgress(
    fn: ((pixels: PeerStrokePixel[]) => void) | undefined
  ) {
    this.#onStrokeProgress = fn;
  }

  copySelection(): Promise<ClipboardOperationResult> {
    return this.#clipboard.copy();
  }

  pasteClipboard(): Promise<ClipboardOperationResult> {
    return this.#clipboard.paste();
  }
}
