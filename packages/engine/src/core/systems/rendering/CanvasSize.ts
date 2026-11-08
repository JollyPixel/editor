// Import Internal Dependencies
import { CanvasDimensions } from "./CanvasDimensions.ts";
import {
  type CanvasFit,
  FillParent
} from "./CanvasFit.ts";

export class CanvasSize {
  layout: CanvasFit = new FillParent();

  #dimensions = CanvasDimensions.empty;
  #applied = CanvasDimensions.empty;

  get dimensions(): CanvasDimensions {
    return this.#dimensions;
  }

  fit(
    width: number,
    height: number
  ): void {
    this.#dimensions = this.layout.fit(width, height);
  }

  commit(): CanvasDimensions | null {
    if (
      this.#dimensions.isEmpty ||
      this.#dimensions.equals(this.#applied)
    ) {
      return null;
    }
    this.#applied = this.#dimensions;

    return this.#dimensions;
  }
}
