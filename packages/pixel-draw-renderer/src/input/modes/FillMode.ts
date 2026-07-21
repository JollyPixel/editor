// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { FillController } from "../../tools/FillController.ts";
import type {
  BrushHighlightOverlay
} from "../../rendering/overlays/BrushHighlightOverlay.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface FillModeOptions {
  fill: FillController;
  highlight: BrushHighlightOverlay;
}

/**
 * Bucket fill (contiguous or global) on click, in the primary or secondary color.
 */
export class FillMode extends InteractionMode {
  readonly id: Mode = "fill";

  #fill: FillController;
  #highlight: BrushHighlightOverlay;

  constructor(
    options: FillModeOptions
  ) {
    super();
    this.#fill = options.fill;
    this.#highlight = options.highlight;
  }

  onExit(): void {
    this.#highlight.hide();
  }

  highlightSize(): number {
    return 1;
  }

  onPrimaryDown(
    pos: Vec2
  ): boolean | void {
    this.#fill.run(pos.x, pos.y, "primary");

    return false;
  }

  onSecondaryDown(
    pos: Vec2
  ): boolean | void {
    this.#fill.run(pos.x, pos.y, "secondary");

    return false;
  }

  onHover(
    cx: number,
    cy: number
  ): void {
    const outside = cx < 0 || cy < 0;
    this.#highlight.update(
      outside ? null : cx,
      outside ? null : cy
    );
  }
}
