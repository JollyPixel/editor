// Import Internal Dependencies
import { CanvasDimensions } from "./CanvasDimensions.ts";

export type CanvasStyles = Pick<CSSStyleDeclaration, "margin" | "flex">;

export interface CanvasFit {
  readonly ratio: number | null;
  readonly styles: Readonly<CanvasStyles>;

  fit(
    width: number,
    height: number
  ): CanvasDimensions;
  observeTarget(
    canvas: HTMLCanvasElement
  ): Element;
}

export class FillParent implements CanvasFit {
  readonly ratio = null;
  readonly styles = Object.freeze({
    margin: "auto",
    flex: "none"
  });

  fit(
    width: number,
    height: number
  ): CanvasDimensions {
    return new CanvasDimensions(width, height);
  }

  observeTarget(
    canvas: HTMLCanvasElement
  ): Element {
    return canvas.parentElement ?? canvas;
  }
}

export class Letterbox implements CanvasFit {
  readonly ratio: number;
  readonly styles = Object.freeze({
    margin: "0",
    flex: "1"
  });

  constructor(
    ratio: number
  ) {
    if (!(ratio > 0) || !Number.isFinite(ratio)) {
      throw new RangeError(
        `Canvas ratio must be a positive number, got ${ratio}.`
      );
    }
    this.ratio = ratio;
  }

  fit(
    width: number,
    height: number
  ): CanvasDimensions {
    if (width / height > this.ratio) {
      return new CanvasDimensions(
        Math.min(width, height * this.ratio),
        height
      );
    }

    return new CanvasDimensions(
      width,
      Math.min(height, width / this.ratio)
    );
  }

  observeTarget(): Element {
    return document.body;
  }
}

export function createCanvasFit(
  ratio: number | null
): CanvasFit {
  return ratio ? new Letterbox(ratio) : new FillParent();
}
