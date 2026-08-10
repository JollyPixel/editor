// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { FillController } from "../../tools/FillController.ts";
import type {
  BrushHighlightView
} from "../../rendering/overlays/BrushHighlight.ts";
import type {
  Mode,
  Vec2
} from "../../types.ts";

export interface FillModeOptions {
  fill: FillController;
  highlight: BrushHighlightView;
}

export class FillMode extends InteractionMode {
  readonly id: Mode = "fill";

  #fill: FillController;
  #highlight: BrushHighlightView;

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
  ): boolean {
    this.#fill.run(
      pos.x,
      pos.y,
      "primary"
    );

    return false;
  }

  onSecondaryDown(
    pos: Vec2
  ): boolean {
    this.#fill.run(
      pos.x,
      pos.y,
      "secondary"
    );

    return false;
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.#highlight.update(
      position?.x ?? null,
      position?.y ?? null
    );
  }
}
