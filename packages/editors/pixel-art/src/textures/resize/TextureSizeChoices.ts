// Import Third-party Dependencies
import type { JollyOption } from "@jolly-pixel/ui";
import type {
  UVRegion,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kSizes = [
  16, 32, 64, 128, 256, 512, 1024, 2048
];

export class TextureSizeChoices {
  readonly #minimum: Vec2;
  readonly #maxSize: number;
  readonly #current: Vec2;

  constructor(
    regions: Iterable<UVRegion>,
    maxSize: number,
    current: Vec2
  ) {
    const minimum = {
      x: 1,
      y: 1
    };
    for (const { bounds } of regions) {
      minimum.x = Math.max(minimum.x, Math.ceil(bounds.x + bounds.width));
      minimum.y = Math.max(minimum.y, Math.ceil(bounds.y + bounds.height));
    }

    this.#minimum = minimum;
    this.#maxSize = maxSize;
    this.#current = {
      ...current
    };
  }

  axis(
    axis: keyof Vec2
  ): JollyOption<number>[] {
    const current = this.#current[axis];
    const sizes = kSizes.filter((size) => size <= this.#maxSize);
    if (!sizes.includes(current)) {
      sizes.push(current);
      sizes.sort((left, right) => left - right);
    }

    return sizes.map((value) => {
      return {
        value,
        label: String(value),
        disabled: value !== current && value < this.#minimum[axis]
      };
    });
  }
}
