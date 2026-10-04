// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ShapeSelect } from "./ShapeSelect.ts";
import type { SelectEngineEvent } from "./SelectEngine.events.ts";
import type { SelectionSnapshot } from "../clipboard/types.ts";
import { SelectionContent } from "../selection/SelectionContent.ts";
import type { SelectionEraseColor } from "../selection/SelectionEraseColor.ts";
import {
  RectArea,
  type ResizeCorner
} from "../utils/RectArea.ts";
import {
  RESIZE_CURSORS,
  resizeCornerAt
} from "../input/resizeHandles.ts";
import type { ScreenProjection } from "../rendering/Viewport.ts";
import { positionKey } from "../utils/math.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  FloatingSelection
} from "../rendering/compositing/FloatingSelection.ts";
import type {
  SelectionOutline
} from "../rendering/overlays/SelectionOutline.ts";
import type { SelectionFootprint } from "../history/HistoryEntry.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import type {
  RGBA8,
  RotationDirection,
  SelectionRect,
  Vec2
} from "../types.ts";

export type {
  SelectEngineEvent,
  SelectionProgressEvent
} from "./SelectEngine.events.ts";

export interface SelectEngineOptions {
  document: Pick<PixelDocument, "buffer" | "paintSelectionEdit">;
  floatingSelection: FloatingSelection;
  selectionOverlay: SelectionOutline;
  eraseColor: SelectionEraseColor;
  viewport: ScreenProjection;
}

export interface SelectTool {
  /**
   * Whether empty-space clicks create shape selections.
   */
  shape: boolean;
  readonly hasSelection: boolean;
  /**
   * Whether the selection is a not-yet-deposited paste. Deselecting it
   * deposits it; `delete()` cancels it.
   */
  readonly isFloating: boolean;
  /**
   * Returns `false` when there is no active selection.
   */
  rotate(
    direction?: RotationDirection
  ): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
  delete(): boolean;
}

type SelectState =
  | {
    kind: "idle";
  }
  | {
    kind: "creating";
    start: Vec2;
    rect: SelectionRect;
  }
  | {
    kind: "selected";
    content: SelectionContent;
    floating: boolean;
  }
  | {
    kind: "resizing";
    content: SelectionContent;
    corner: ResizeCorner;
    origin: Vec2;
    rect: SelectionRect;
  }
  | {
    kind: "moving";
    content: SelectionContent;
    floating: boolean;
    origin: Vec2;
    live: SelectionContent;
  };

type SelectedState = Extract<SelectState, { kind: "selected"; }>;

export class SelectEngine extends Emitter<SelectEngineEvent> implements SelectTool {
  #state: SelectState = { kind: "idle" };
  #canvasBuffer: CanvasBuffer;
  #floatingSelection: FloatingSelection;
  #selectionOverlay: SelectionOutline;
  #eraseColor: SelectionEraseColor;
  #document: Pick<PixelDocument, "paintSelectionEdit">;
  #shapeMode = false;
  #publishedHasSelection = false;
  #publishedIsFloating = false;
  #readOnly = false;
  #viewport: ScreenProjection;
  #hoverPoint: Vec2 | null = null;

  constructor(
    options: SelectEngineOptions
  ) {
    super();
    this.#canvasBuffer = options.document.buffer;
    this.#floatingSelection = options.floatingSelection;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#document = options.document;
    this.#viewport = options.viewport;
  }

  get isDragging(): boolean {
    return this.#state.kind === "moving";
  }

  get hasSelection(): boolean {
    return this.#state.kind === "selected" ||
      this.#state.kind === "moving" ||
      this.#state.kind === "resizing";
  }

  get isFloating(): boolean {
    const state = this.#state;

    return (state.kind === "selected" || state.kind === "moving") && state.floating;
  }

  get shape(): boolean {
    return this.#shapeMode;
  }

  set shape(
    shapeMode: boolean
  ) {
    if (this.#shapeMode === shapeMode) {
      return;
    }

    this.#shapeMode = shapeMode;
    this.clear();
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  set readOnly(
    readOnly: boolean
  ) {
    if (readOnly && !this.#readOnly) {
      this.clear();
    }
    this.#readOnly = readOnly;
  }

  get editable(): boolean {
    return !this.#readOnly && this.#state.kind === "selected";
  }

  get cursor(): string {
    if (this.#state.kind === "resizing") {
      return RESIZE_CURSORS[this.#state.corner];
    }
    if (this.isDragging) {
      return "grabbing";
    }
    const corner = this.#hoverPoint === null ?
      null : this.#resizeHit(this.#hoverPoint);

    if (corner !== null) {
      return RESIZE_CURSORS[corner];
    }

    return this.editable ? "grab" : "";
  }

  hover(
    point: Vec2 | null
  ): void {
    this.#hoverPoint = point === null ? null : { ...point };
  }

  handleStart(
    pos: Vec2,
    point: Vec2
  ): void {
    const state = this.#state;
    this.hover(point);
    const corner = this.#resizeHit(point);
    if (corner !== null && state.kind === "selected") {
      this.#state = {
        kind: "resizing",
        content: state.content,
        corner,
        origin: this.#viewport.toTexture(point),
        rect: state.content.rect
      };
      this.refreshOverlay();

      return;
    }
    if (
      !this.#readOnly &&
      state.kind === "selected" &&
      state.content.hitTest(pos)
    ) {
      this.#startMove(state, pos);

      return;
    }

    this.clear();

    if (this.#shapeMode) {
      this.#startShapeSelection(pos);
    }
    else {
      const rect = SelectEngine.#spanning(pos, pos);
      this.#state = { kind: "creating", start: pos, rect };
      this.#selectionOverlay.draw(rect);
    }
  }

  handleMove(
    pos: Vec2,
    point: Vec2
  ): void {
    const state = this.#state;

    if (state.kind === "creating") {
      const rect = SelectEngine.#spanning(state.start, pos);
      this.#state = { ...state, rect };
      this.#selectionOverlay.draw(rect);
      this.emit(
        "selection-progress",
        { phase: "creating", rect }
      );
    }
    else if (state.kind === "resizing") {
      const pointer = this.#viewport.toTexture(point);
      const rect = RectArea.from(state.content.rect).resized(state.corner, {
        x: Math.round(pointer.x - state.origin.x),
        y: Math.round(pointer.y - state.origin.y)
      }).bounds;
      this.#state = { ...state, rect };
      this.refreshOverlay();
      this.emit("selection-progress", { phase: "creating", rect });
    }
    else if (state.kind === "moving") {
      const live = state.content.movedTo({
        x: state.content.rect.x + pos.x - state.origin.x,
        y: state.content.rect.y + pos.y - state.origin.y
      });
      this.#state = { ...state, live };
      this.#selectionOverlay.draw(live.rect, live.mask);
      this.#floatingSelection.updatePosition(live.rect);
      this.emit(
        "selection-progress",
        {
          phase: "moving",
          sourceRect: state.content.rect,
          liveRect: live.rect,
          mask: live.mask,
          blankSource: !state.floating
        }
      );
    }
  }

  handleEnd(): void {
    const state = this.#state;

    if (state.kind === "creating") {
      this.#finishCreate(state.rect);
    }
    else if (state.kind === "moving") {
      this.#finishMove(state);
    }
    else if (state.kind === "resizing") {
      this.#finishResize(state);
    }
  }

  exportSelection(): SelectionSnapshot | null {
    return this.#state.kind === "selected" ? this.#state.content.toJSON() : null;
  }

  importSelection(
    snapshot: SelectionSnapshot
  ): boolean {
    const content = this.#readOnly ? null : SelectionContent.parse(snapshot);
    if (content === null) {
      return false;
    }

    this.clear();
    this.#state = { kind: "selected", content, floating: true };
    this.#showFloatingSelection(content);
    this.refreshOverlay();
    this.#publishSelectionState();

    return true;
  }

  delete(): boolean {
    const state = this.#state;
    if (this.#readOnly || state.kind !== "selected") {
      return false;
    }

    if (state.floating) {
      this.discard();

      return true;
    }

    const erased = state.content.erased(
      this.#eraseColor.resolve(this.#canvasBuffer, state.content.rect)
    );
    this.#commit(state.content, erased, false);
    this.#state = { ...state, content: erased };

    return true;
  }

  rotate(
    direction: RotationDirection = "cw"
  ): boolean {
    return this.#transform((content) => content.rotated(direction));
  }

  flipHorizontal(): boolean {
    return this.#transform((content) => content.flippedHorizontal());
  }

  flipVertical(): boolean {
    return this.#transform((content) => content.flippedVertical());
  }

  clear(): void {
    this.#depositFloating();
    this.discard();
  }

  discard(): void {
    const interruptedGesture = this.#state.kind === "creating" ||
      this.#state.kind === "moving" || this.#state.kind === "resizing";

    this.#state = { kind: "idle" };
    this.#selectionOverlay.clear();
    this.#floatingSelection.clear();

    // An interrupted gesture has no command, so clear its peer ghost explicitly.
    if (interruptedGesture) {
      this.emit("selection-idle");
    }
    this.#publishSelectionState();
  }

  refreshOverlay(): void {
    const state = this.#state;

    switch (state.kind) {
      case "creating":
        this.#selectionOverlay.draw(state.rect);
        break;
      case "selected":
        this.#selectionOverlay.draw(
          state.content.rect,
          state.content.mask,
          this.#resizableContent() !== null
        );
        break;
      case "resizing":
        this.#selectionOverlay.draw(state.rect, null, true);
        break;
      case "moving":
        this.#selectionOverlay.draw(state.live.rect, state.live.mask);
        break;
      case "idle":
        break;
      default:
        state satisfies never;
    }
  }

  syncSelectionAfterHistory(
    footprint: SelectionFootprint
  ): void {
    const content = SelectionContent.capture(
      this.#canvasBuffer,
      footprint.rect,
      [...footprint.mask]
    );
    this.#state = { kind: "selected", content, floating: false };
    this.refreshOverlay();
    this.#publishSelectionState();
  }

  #startMove(
    state: SelectedState,
    pos: Vec2
  ): void {
    const { content, floating } = state;

    this.#state = {
      kind: "moving",
      content,
      floating,
      origin: pos,
      live: content
    };
    this.refreshOverlay();
    this.#floatingSelection.create({
      sourceRect: content.rect,
      pixels: content.pixels,
      mask: content.mask,
      eraseColor: this.#eraseColor.resolve(this.#canvasBuffer, content.rect),
      blankSource: !floating
    });
  }

  #startShapeSelection(
    pos: Vec2
  ): void {
    const shape = ShapeSelect.compute(
      this.#canvasBuffer,
      pos
    );
    if (!shape) {
      return;
    }

    const content = SelectionContent.capture(
      this.#canvasBuffer,
      shape.rect,
      shape.mask
    );
    this.#state = { kind: "selected", content, floating: false };
    this.refreshOverlay();
    this.#publishSelectionState();
    // Shape selection has no command, so clear its peer ghost explicitly.
    this.emit("selection-idle");
  }

  #finishCreate(
    rect: SelectionRect
  ): void {
    const finalRect = RectArea.from(rect).intersection(this.#canvasBuffer.size());
    if (
      finalRect === null ||
      (finalRect.width === 1 && finalRect.height === 1)
    ) {
      this.clear();

      return;
    }

    this.#state = {
      kind: "selected",
      content: SelectionContent.capture(this.#canvasBuffer, finalRect),
      floating: false
    };
    this.refreshOverlay();
    this.#publishSelectionState();
    this.emit("selection-idle");
  }

  #finishMove(
    state: Extract<SelectState, { kind: "moving"; }>
  ): void {
    const { content, live, floating } = state;
    const moved = live.rect.x !== content.rect.x || live.rect.y !== content.rect.y;

    this.#floatingSelection.clear();
    this.#state = { kind: "selected", content: live, floating: false };

    if (moved || floating) {
      this.#commit(content, live, !floating);
      this.emit("selection-committed");
    }
    else {
      this.emit("selection-idle");
    }

    this.refreshOverlay();
    this.#publishSelectionState();
  }

  #finishResize(
    state: Extract<SelectState, { kind: "resizing"; }>
  ): void {
    const rect = RectArea.from(state.rect).intersection(
      this.#canvasBuffer.size()
    );
    const before = state.content.rect;
    const unchanged = rect === null || [state.rect, rect].some(
      (candidate) => candidate.x === before.x && candidate.y === before.y &&
        candidate.width === before.width && candidate.height === before.height
    );
    this.#state = {
      kind: "selected",
      content: unchanged ? state.content :
        SelectionContent.capture(this.#canvasBuffer, rect),
      floating: false
    };
    this.refreshOverlay();
    this.emit("selection-idle");
  }

  #transform(
    transform: (content: SelectionContent) => SelectionContent
  ): boolean {
    const state = this.#state;
    if (this.#readOnly || state.kind !== "selected") {
      return false;
    }

    const content = transform(state.content);
    if (state.floating) {
      this.#showFloatingSelection(content);
    }
    else {
      this.#commit(state.content, content, true);
    }
    this.#state = { ...state, content };
    this.refreshOverlay();

    return true;
  }

  #depositFloating(): void {
    const state = this.#state;
    if (state.kind !== "selected" || !state.floating) {
      return;
    }

    this.#state = { ...state, floating: false };
    this.#commit(state.content, state.content, false);
    this.emit("selection-committed");
  }

  #showFloatingSelection(
    content: SelectionContent
  ): void {
    this.#floatingSelection.create({
      sourceRect: content.rect,
      pixels: content.pixels,
      mask: content.mask,
      eraseColor: this.#eraseColor.resolve(this.#canvasBuffer, content.rect),
      blankSource: false
    });
  }

  #commit(
    before: SelectionContent,
    after: SelectionContent,
    vacate: boolean
  ): void {
    const positions = this.#footprintPositions(before, after);
    const beforeColors = this.#canvasBuffer.samplePixels(positions);
    const eraseColor: RGBA8 | null = vacate ?
      this.#eraseColor.resolve(this.#canvasBuffer, before.rect) :
      null;
    const afterColors = positions.map((position, index) => {
      if (after.hitTest(position)) {
        return after.colorAt(position);
      }

      return eraseColor !== null && before.hitTest(position) ?
        eraseColor :
        beforeColors[index];
    });

    this.#document.paintSelectionEdit({
      positions,
      beforeColors,
      afterColors,
      before: {
        rect: { ...before.rect },
        mask: [...before.mask]
      },
      after: {
        rect: { ...after.rect },
        mask: [...after.mask]
      }
    });
  }

  #footprintPositions(
    before: SelectionContent,
    after: SelectionContent
  ): Vec2[] {
    const size = this.#canvasBuffer.size();
    const seen = new Set<string>();
    const positions: Vec2[] = [];

    for (const content of [before, after]) {
      for (const position of content.positions()) {
        const key = positionKey(position);
        if (
          position.x >= 0 && position.x < size.x &&
          position.y >= 0 && position.y < size.y &&
          !seen.has(key)
        ) {
          seen.add(key);
          positions.push(position);
        }
      }
    }

    return positions;
  }

  #publishSelectionState(): void {
    const hasSelection = this.hasSelection;
    const isFloating = this.isFloating;
    if (
      hasSelection === this.#publishedHasSelection &&
      isFloating === this.#publishedIsFloating
    ) {
      return;
    }

    this.#publishedHasSelection = hasSelection;
    this.#publishedIsFloating = isFloating;
    this.emit(
      "selection-state-changed",
      {
        hasSelection,
        isFloating
      }
    );
  }

  #resizableContent(): SelectionContent | null {
    const state = this.#state;
    if (
      state.kind !== "selected" || state.floating || this.#shapeMode ||
      !state.content.mask.every(Boolean)
    ) {
      return null;
    }

    return state.content;
  }

  #resizeHit(
    point: Vec2
  ): ResizeCorner | null {
    const content = this.#resizableContent();

    return content === null ? null : resizeCornerAt(
      this.#viewport.toScreenRect(content.rect),
      point
    );
  }

  static #spanning(
    a: Vec2,
    b: Vec2
  ): SelectionRect {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x) + 1,
      height: Math.abs(b.y - a.y) + 1
    };
  }
}
