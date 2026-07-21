// Import Internal Dependencies
import { Select } from "./Select.ts";
import { ShapeSelect } from "./ShapeSelect.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type {
  CanvasRenderer
} from "../rendering/CanvasRenderer.ts";
import type {
  SelectionOverlay
} from "../rendering/overlays/SelectionOverlay.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";

export interface SelectEditEntry {
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

const kTransparent: RGBA = { r: 0, g: 0, b: 0, a: 0 };

export interface SelectControllerOptions {
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
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
export class SelectController implements SelectTool {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #selectionOverlay: SelectionOverlay;
  #eraseColor: RGBA | null;
  #pipeline: EditPipeline;
  #shapeMode = false;

  constructor(
    options: SelectControllerOptions
  ) {
    this.#canvasBuffer = options.canvasBuffer;
    this.#renderer = options.renderer;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#pipeline = options.pipeline;
  }

  /**
   * Resolves the fill for a vacated footprint: the explicit `eraseColor`
   * when configured, otherwise the most common color among the pixels
   * surrounding `rect` (so it blends into the artwork), falling back to
   * fully transparent when `rect` has no in-bounds neighbors.
   */
  #resolveEraseColor(
    rect: SelectionRect
  ): RGBA {
    if (this.#eraseColor !== null) {
      return this.#eraseColor;
    }

    return Select.dominantBorderColor(this.#canvasBuffer, rect, kTransparent);
  }

  get rect(): SelectionRect | null {
    return this.#select.rect;
  }

  /**
   * Whether an existing selection is currently being dragged to a new
   * position (as opposed to being drawn for the first time).
   */
  get isDragging(): boolean {
    return this.#select.state === "moving";
  }

  /**
   * Whether there's a committed selection to grab — idle ("selected") or
   * actively being dragged ("moving"). `false` while a brand-new rectangle
   * is still being drawn ("creating") or nothing is selected ("idle").
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
      const eraseColor = this.#resolveEraseColor(rect);
      this.#renderer.floatingSelection.create({
        sourceRect: rect,
        pixels: snapshot,
        mask,
        eraseColor,
        blankSource: !this.#select.willSkipErase
      });
      this.#renderer.drawFrame();
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
  }

  handleMove(
    pos: Vec2
  ): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.updateCreate(pos);
      if (rect) {
        this.#selectionOverlay.drawRect(rect);
      }

      return;
    }

    if (this.#select.state === "moving") {
      const rect = this.#select.updateMove(pos);
      const mask = this.#select.mask;
      if (rect && mask) {
        this.#selectionOverlay.drawMask(rect, mask);
        this.#renderer.floatingSelection.updatePosition(rect);
        this.#renderer.drawFrame();
      }
    }
  }

  handleEnd(): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.rect;
      if (rect) {
        if (rect.width === 1 && rect.height === 1) {
          this.#select.clear();
          this.#selectionOverlay.clear();
        }
        else {
          const snapshot = Select.captureSnapshot(
            this.#canvasBuffer,
            rect
          );
          this.#select.finishCreate(snapshot);
        }
      }

      return;
    }

    if (this.#select.state === "moving") {
      const snapshot = this.#select.snapshot;
      const mask = this.#select.mask;
      const result = this.#select.finishMove();
      this.#renderer.floatingSelection.clear();

      if (result && snapshot && mask) {
        this.#commitFootprintChange({
          oldRect: result.source,
          oldMask: mask,
          newRect: result.dest,
          newMask: mask,
          newContent: snapshot,
          skipErase: result.skipErase
        });
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
    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#renderer.floatingSelection.clear();
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

    const afterColors = this.#canvasBuffer.samplePixels(positions);
    this.#renderer.drawFrame();
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
