// Import Internal Dependencies
import type { PixelDocument } from "../PixelDocument.ts";
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type {
  Brush,
  BrushPaintSource
} from "../tools/Brush.ts";
import type { FillGlobalCommit } from "../tools/FillEngine.ts";
import type { SelectEditEntry } from "../tools/SelectEngine.ts";

export interface EditPipelineOptions {
  brush: Brush;
  document: PixelDocument;
}

export class EditPipeline {
  #brush: Brush;
  #document: PixelDocument;

  constructor(
    options: EditPipelineOptions
  ) {
    this.#brush = options.brush;
    this.#document = options.document;
  }

  commitStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#document.commitStroke(pixels, color, beforeColors);
  }

  commitPixels(
    pixels: Vec2[],
    source: BrushPaintSource = "primary",
    uniformBeforeColor?: RGBA8
  ): void {
    if (pixels.length === 0) {
      return;
    }

    this.#document.commitPixels(
      pixels,
      this.#brush.colorFor(source),
      uniformBeforeColor
    );
  }

  commitGlobalFill(
    commit: FillGlobalCommit
  ): void {
    this.#document.commitGlobalFill(commit);
  }

  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#document.commitSelectionEdit(entry);
  }
}
