// Import Third-party Dependencies
import type { RGBA } from "@jolly-pixel/color";

// Import Internal Dependencies
import type { PickerSpace } from "./space.ts";
import {
  hueSaturationAt,
  snapToWheel
} from "./wheel.ts";

// CONSTANTS
const kResolution = 64;
const kDiscreteResolution = 160;
const kByte = 255;
const kPainted = new WeakMap<HTMLCanvasElement, string>();

export interface PickerSurface {
  readonly key: string;
  readonly resolution: number;
  colorAt(x: number, y: number): RGBA;
}

export class SquareSurface implements PickerSurface {
  readonly key: string;
  readonly resolution = kResolution;
  readonly #space: PickerSpace;
  readonly #hue: number;

  constructor(
    space: PickerSpace,
    hue: number
  ) {
    this.#space = space;
    this.#hue = hue;
    this.key = `square:${space.name}:${hue}`;
  }

  colorAt(
    x: number,
    y: number
  ): RGBA {
    return this.#space.toRgb({
      h: this.#hue,
      s: x,
      v: 1 - y,
      a: 1
    });
  }
}

export class WheelSurface implements PickerSurface {
  readonly key: string;
  readonly resolution: number;
  readonly #space: PickerSpace;
  readonly #value: number;
  readonly #discrete: boolean;
  readonly #cells = new Map<string, RGBA>();

  constructor(
    space: PickerSpace,
    value: number,
    discrete: boolean
  ) {
    this.#space = space;
    this.#value = value;
    this.#discrete = discrete;
    this.resolution = discrete ? kDiscreteResolution : kResolution;
    this.key = `wheel:${space.name}:${value}:${discrete}`;
  }

  colorAt(
    x: number,
    y: number
  ): RGBA {
    const polar = hueSaturationAt((x * 2) - 1, (y * 2) - 1);
    if (!this.#discrete) {
      return this.#toRgb(polar.h, polar.s);
    }

    const { h, s } = snapToWheel(polar);
    const cell = `${h}:${s}`;
    let color = this.#cells.get(cell);
    if (color === undefined) {
      color = this.#toRgb(h, s);
      this.#cells.set(cell, color);
    }

    return color;
  }

  #toRgb(
    h: number,
    s: number
  ): RGBA {
    return this.#space.toRgb({
      h,
      s,
      v: this.#value,
      a: 1
    });
  }
}

export function paintSurface(
  canvas: HTMLCanvasElement,
  surface: PickerSurface
): void {
  if (kPainted.get(canvas) === surface.key) {
    return;
  }

  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  const { resolution } = surface;
  canvas.width = resolution;
  canvas.height = resolution;
  const image = context.createImageData(resolution, resolution);
  const { data } = image;
  for (let row = 0; row < resolution; row++) {
    for (let column = 0; column < resolution; column++) {
      const color = surface.colorAt(
        (column + 0.5) / resolution,
        (row + 0.5) / resolution
      );
      const offset = ((row * resolution) + column) * 4;
      data[offset] = Math.round(color.r * kByte);
      data[offset + 1] = Math.round(color.g * kByte);
      data[offset + 2] = Math.round(color.b * kByte);
      data[offset + 3] = kByte;
    }
  }
  context.putImageData(image, 0, 0);
  kPainted.set(canvas, surface.key);
}
