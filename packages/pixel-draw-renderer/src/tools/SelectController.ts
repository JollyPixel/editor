// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { Select } from "./Select.ts";
import { ShapeSelect } from "./ShapeSelect.ts";
import type { SelectControllerEvent } from "./SelectController.events.ts";
import { clipRectToBounds } from "../utils/math.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  FloatingSelectionOverlay
} from "../rendering/overlays/FloatingSelectionOverlay.ts";
import type {
  SelectionOverlay
} from "../rendering/overlays/SelectionOverlay.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";

export type {
  SelectControllerEvent,
  SelectionProgressEvent
} from "./SelectController.events.ts";

export interface SelectEditEntry {
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export interface SelectControllerOptions {
  canvasBuffer: CanvasBuffer;
  /** The floating overlay that renders a selection while it is dragged. */
  floatingSelection: FloatingSelectionOverlay;
  selectionOverlay: SelectionOverlay;
  /**
   * Explicit fill for a vacated footprint (Move/Rotate/Flip source, or
   * Delete), overriding the smart default below. `null` when not
   * configured by the consumer.
   */
  eraseColor: RGBA | null;
  pipeline: EditPipeline;
}

/**
 * Public select-tool surface (`PixelArtCanvas.tools.select`).
 */
export interface SelectTool {
  /** Whether empty-space clicks create shape (magic-wand) selections. */
  shape: boolean;
  /** Whether a committed selection exists to transform. */
  readonly hasSelection: boolean;
  /** Rotates the active selection clockwise; `false` when none. */
  rotate(): boolean;
  /** Mirrors the active selection horizontally; `false` when none. */
  flipHorizontal(): boolean;
  /** Mirrors the active selection vertically; `false` when none. */
  flipVertical(): boolean;
}

/**
 * Coordinates selection state, rendering, and commits.
 */
export class SelectController extends Emitter<SelectControllerEvent> implements SelectTool {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #floatingSelection: FloatingSelectionOverlay;
  #selectionOverlay: SelectionOverlay;
  #eraseColor: RGBA | null;
  #pipeline: EditPipeline;
  #shapeMode = false;
  /** The dragged selection's origin rect + erase policy for progress ticks. */
  #moveSourceRect: SelectionRect | null = null;
  #moveBlankSource = true;

  constructor(
    options: SelectControllerOptions
  ) {
    super();
    this.#canvasBuffer = options.canvasBuffer;
    this.#floatingSelection = options.floatingSelection;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#pipeline = options.pipeline;
  }

  /**
   * Resolve fill for a vacated footprint: explicit eraseColor or dominant
   * surrounding color, falling back to transparent.
   */
  #resolveEraseColor(
    rect: SelectionRect
  ): RGBA {
    return Select.resolveEraseColor(this.#canvasBuffer, rect, this.#eraseColor);
  }

  get rect(): SelectionRect | null {
    return this.#select.rect;
  }

  /**
   * Whether a committed selection is being dragged (not still being drawn).
   */
  get isDragging(): boolean {
    return this.#select.state === "moving";
  }

  /**
   * Whether a committed selection exists - selected or moving, not creating.
   */
  get hasSelection(): boolean {
    return this.#select.state === "selected" || this.#select.state === "moving";
  }

  /**
   * Whether empty-space clicks create shape selections.
   */
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

  /**
   * Starts creating or moving a selection.
   */
  handleStart(
    pos: Vec2
  ): void {
    if (
      this.#select.state === "selected" &&
      this.#select.hitTest(pos)
    ) {
      this.#startMoveAt(pos);

      return;
    }

    this.clear();

    if (this.#shapeMode) {
      this.#startShapeSelection(pos);
    }
    else {
      const rect = this.#select.startCreate(pos);
      this.#selectionOverlay.drawRect(rect);
    }
  }

  #startMoveAt(
    pos: Vec2
  ): void {
    this.#select.startMove(pos);

    const rect = this.#select.rect;
    const snapshot = this.#select.snapshot;
    const mask = this.#select.mask;
    if (rect && snapshot && mask) {
      const blankSource = !this.#select.willSkipErase;
      const eraseColor = this.#resolveEraseColor(rect);
      this.#floatingSelection.create({
        sourceRect: rect,
        pixels: snapshot,
        mask,
        eraseColor,
        blankSource
      });
      this.#moveSourceRect = rect;
      this.#moveBlankSource = blankSource;
    }
  }

  #startShapeSelection(
    pos: Vec2
  ): void {
    const shape = ShapeSelect.compute(this.#canvasBuffer, pos);
    if (!shape) {
      return;
    }

    const snapshot = Select.captureSnapshot(
      this.#canvasBuffer,
      shape.rect
    );
    this.#select.selectRegion(
      shape.rect,
      snapshot,
      shape.mask
    );
    this.#selectionOverlay.drawMask(shape.rect, shape.mask);
    // Shape-select resolves instantly with no command - clear peer ghost explicitly.
    this.emit("selection-idle");
  }

  handleMove(
    pos: Vec2
  ): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.updateCreate(pos);
      if (rect) {
        this.#selectionOverlay.drawRect(rect);
        this.emit("selection-progress", { phase: "creating", rect });
      }

      return;
    }

    if (this.#select.state === "moving") {
      const rect = this.#select.updateMove(pos);
      const mask = this.#select.mask;
      if (rect && mask) {
        this.#selectionOverlay.drawMask(rect, mask);
        this.#floatingSelection.updatePosition(rect);
      }
      if (rect && mask && this.#moveSourceRect) {
        this.emit("selection-progress", {
          phase: "moving",
          sourceRect: this.#moveSourceRect,
          liveRect: rect,
          mask,
          blankSource: this.#moveBlankSource
        });
      }
    }
  }

  handleEnd(): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.rect;
      const finalRect = rect
        ? clipRectToBounds(rect, this.#canvasBuffer.size())
        : null;
      if (
        !finalRect ||
        (finalRect.width === 1 && finalRect.height === 1)
      ) {
        this.#select.clear();
        this.#selectionOverlay.clear();
        this.emit("selection-idle");

        return;
      }

      const snapshot = Select.captureSnapshot(
        this.#canvasBuffer,
        finalRect
      );
      this.#select.finishCreate(snapshot, finalRect);
      this.#selectionOverlay.drawRect(finalRect);
      // Creation never commits a command - nothing to reconcile on peers.
      this.emit("selection-idle");

      return;
    }

    if (this.#select.state === "moving") {
      const snapshot = this.#select.snapshot;
      const mask = this.#select.mask;
      const result = this.#select.finishMove();
      this.#floatingSelection.clear();
      this.#moveSourceRect = null;

      if (result && snapshot && mask) {
        this.#commitFootprintChange({
          oldRect: result.source,
          oldMask: mask,
          newRect: result.dest,
          newMask: mask,
          newContent: snapshot,
          skipErase: result.skipErase
        });
        // Command already sent; drop pending ghost tick.
        this.emit("selection-committed");
      }
      else {
        // No-op drag (dropped on source) - same as creation: nothing to reconcile.
        this.emit("selection-idle");
      }

      const rect = this.#select.rect;
      const currentMask = this.#select.mask;
      if (rect && currentMask) {
        this.#selectionOverlay.drawMask(
          rect,
          currentMask
        );
      }
    }
  }

  /**
   * Copies the active selection.
   */
  handleCopy(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    this.#select.copy();

    return true;
  }

  /**
   * Pastes the clipboard as the active selection.
   */
  handlePaste(): boolean {
    const result = this.#select.paste();
    if (!result) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: result.rect,
      oldMask: result.mask,
      newRect: result.rect,
      newMask: result.mask,
      newContent: result.pixels,
      skipErase: true
    });
    this.#selectionOverlay.drawMask(
      result.rect,
      result.mask
    );

    return true;
  }

  /**
   * Erases the active selection.
   */
  handleDelete(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const rect = this.#select.rect;
    const mask = this.#select.mask;
    if (!rect || !mask) {
      return false;
    }

    const eraseColor = this.#resolveEraseColor(rect);
    const eraseColors: RGBA[] = new Array(
      rect.width * rect.height
    ).fill(eraseColor);
    this.#commitFootprintChange({
      oldRect: rect,
      oldMask: mask,
      newRect: rect,
      newMask: mask,
      newContent: eraseColors,
      skipErase: true
    });
    this.#select.markErased(eraseColor);

    return true;
  }

  /**
   * Rotates the active selection clockwise.
   */
  rotate(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const oldMask = this.#select.mask;
    const result = this.#select.rotate();
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!result || !snapshot || !oldMask || !newMask) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: result.oldRect,
      oldMask,
      newRect: result.newRect,
      newMask,
      newContent: snapshot,
      skipErase: false
    });
    this.#selectionOverlay.drawMask(
      result.newRect,
      newMask
    );

    return true;
  }

  flipHorizontal(): boolean {
    return this.#handleFlip((select) => select.flipHorizontal());
  }

  flipVertical(): boolean {
    return this.#handleFlip((select) => select.flipVertical());
  }

  #handleFlip(
    flip: (select: Select) => SelectionRect | null
  ): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const oldMask = this.#select.mask;
    const rect = flip(this.#select);
    const snapshot = this.#select.snapshot;
    const newMask = this.#select.mask;
    if (!rect || !snapshot || !oldMask || !newMask) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: rect,
      oldMask,
      newRect: rect,
      newMask,
      newContent: snapshot,
      skipErase: false
    });
    this.#selectionOverlay.drawMask(rect, newMask);

    return true;
  }

  clear(): void {
    const interruptedGesture = this.#select.state === "creating" || this.#select.state === "moving";

    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#floatingSelection.clear();
    this.#moveSourceRect = null;

    // A mid-gesture interruption (e.g. mode switch) produces no command - nothing to reconcile.
    if (interruptedGesture) {
      this.emit("selection-idle");
    }
  }

  refreshOverlay(): void {
    const rect = this.#select.rect;
    const mask = this.#select.mask;

    if (rect && mask) {
      this.#selectionOverlay.drawMask(rect, mask);
    }
  }

  #commitFootprintChange(
    change: {
      oldRect: SelectionRect;
      oldMask: boolean[];
      newRect: SelectionRect;
      newMask: boolean[];
      newContent: RGBA[];
      skipErase: boolean;
    }
  ): void {
    const {
      oldRect,
      oldMask,
      newRect,
      newMask,
      newContent,
      skipErase
    } = change;

    const positions = unionMaskedPositions(
      { rect: oldRect, mask: oldMask },
      { rect: newRect, mask: newMask }
    );
    const beforeColors = this.#canvasBuffer.samplePixels(positions);

    if (!skipErase) {
      const eraseColor = this.#resolveEraseColor(oldRect);
      this.#canvasBuffer.drawPixels(
        maskedPositions({ rect: oldRect, mask: oldMask }),
        eraseColor
      );
    }
    this.#canvasBuffer.drawMaskedRegion(
      newRect,
      newContent,
      newMask
    );
    this.#canvasBuffer.copyToMaster();

    // drawPixels/drawMaskedRegion already repainted; afterColors sampled
    // from buffer, unaffected by repaint timing.
    const afterColors = this.#canvasBuffer.samplePixels(positions);
    this.#pipeline.commitSelectionEdit({
      positions,
      beforeColors,
      afterColors,
      oldRect,
      newRect,
      oldMask,
      newMask
    });
  }

  /**
   * Restores selection state after a history replay.
   */
  syncSelectionAfterHistory(
    rect: SelectionRect,
    mask: boolean[]
  ): void {
    const snapshot = Select.captureSnapshot(
      this.#canvasBuffer,
      rect
    );
    this.#select.restoreRect(rect, snapshot, mask);
    this.#selectionOverlay.drawMask(rect, mask);
  }
}

interface MaskedFootprint {
  rect: SelectionRect;
  mask: boolean[];
}

function* maskedPositions(
  footprint: MaskedFootprint
): IterableIterator<Vec2> {
  const { rect, mask } = footprint;

  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (mask[(y * rect.width) + x]) {
        yield { x: rect.x + x, y: rect.y + y };
      }
    }
  }
}

function unionMaskedPositions(
  a: MaskedFootprint,
  b: MaskedFootprint
): Vec2[] {
  const seen = new Set<string>();
  const result: Vec2[] = [];

  for (const pos of [...maskedPositions(a), ...maskedPositions(b)]) {
    const key = `${pos.x},${pos.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pos);
    }
  }

  return result;
}
