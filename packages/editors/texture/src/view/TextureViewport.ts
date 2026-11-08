// Import Third-party Dependencies
import { clamp } from "@jolly-pixel/utils";

// CONSTANTS
const kMinScale = 1 / 64;
const kMaxScale = 64;
const kFitPadding = 64;

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

export interface ViewPoint {
  readonly x: number;
  readonly y: number;
}

export interface ViewportPlacement {
  readonly image: ViewSize;
  readonly fitted: boolean;
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface ViewportFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export class TextureViewport {
  static fit(
    view: ViewSize,
    image: ViewSize
  ): TextureViewport {
    if (image.width <= 0 || image.height <= 0) {
      return TextureViewport.#centered(view, image, 1, true);
    }

    const scale = Math.min(
      (view.width - (2 * kFitPadding)) / image.width,
      (view.height - (2 * kFitPadding)) / image.height
    );

    return TextureViewport.#centered(
      view,
      image,
      scale >= 1 ? Math.floor(scale) : scale,
      true
    );
  }

  static actualSize(
    view: ViewSize,
    image: ViewSize
  ): TextureViewport {
    return TextureViewport.#centered(view, image, 1, false);
  }

  static #centered(
    view: ViewSize,
    image: ViewSize,
    scale: number,
    fitted: boolean
  ): TextureViewport {
    const clamped = clamp(scale, kMinScale, kMaxScale);

    return new TextureViewport({
      image,
      fitted,
      scale: clamped,
      x: (view.width - (image.width * clamped)) / 2,
      y: (view.height - (image.height * clamped)) / 2
    });
  }

  readonly image: ViewSize;
  readonly fitted: boolean;
  readonly scale: number;
  readonly x: number;
  readonly y: number;

  constructor(
    placement: ViewportPlacement
  ) {
    this.image = {
      width: placement.image.width,
      height: placement.image.height
    };
    this.fitted = placement.fitted;
    this.scale = placement.scale;
    this.x = placement.x;
    this.y = placement.y;
  }

  get percent(): number {
    return Math.round(this.scale * 100);
  }

  get frame(): ViewportFrame {
    return {
      left: this.x,
      top: this.y,
      width: this.image.width * this.scale,
      height: this.image.height * this.scale
    };
  }

  adaptTo(
    view: ViewSize,
    image: ViewSize
  ): TextureViewport {
    const sameImage = image.width === this.image.width &&
      image.height === this.image.height;

    return sameImage && !this.fitted ?
      this :
      TextureViewport.fit(view, image);
  }

  zoomAt(
    point: ViewPoint,
    factor: number
  ): TextureViewport {
    const scale = clamp(this.scale * factor, kMinScale, kMaxScale);
    const ratio = scale / this.scale;

    return new TextureViewport({
      image: this.image,
      fitted: false,
      scale,
      x: point.x - ((point.x - this.x) * ratio),
      y: point.y - ((point.y - this.y) * ratio)
    });
  }

  panBy(
    dx: number,
    dy: number
  ): TextureViewport {
    return new TextureViewport({
      image: this.image,
      fitted: false,
      scale: this.scale,
      x: this.x + dx,
      y: this.y + dy
    });
  }
}
