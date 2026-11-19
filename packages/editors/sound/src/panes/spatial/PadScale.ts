// Import Internal Dependencies
import type { PlanePoint } from "../../player/spatial/PlanePoint.ts";

// CONSTANTS
const kMinExtent = 10;

export class PadScale {
  static covering(
    distance: number
  ): PadScale {
    const decade = 10 ** Math.ceil(Math.log10(Math.max(distance, 1)));

    return new PadScale(Math.max(decade, kMinExtent));
  }

  readonly extent: number;

  #span: number;

  constructor(
    extent: number
  ) {
    this.extent = extent;
    this.#span = Math.log1p(extent);
  }

  radius(
    distance: number
  ): number {
    return Math.log1p(Math.max(distance, 0)) / this.#span;
  }

  distance(
    radius: number
  ): number {
    return Math.expm1(Math.max(radius, 0) * this.#span);
  }

  toPad(
    point: PlanePoint
  ): PlanePoint {
    return this.#rescale(point, (distance) => this.radius(distance));
  }

  toWorld(
    point: PlanePoint
  ): PlanePoint {
    return this.#rescale(point, (radius) => this.distance(radius));
  }

  #rescale(
    point: PlanePoint,
    map: (length: number) => number
  ): PlanePoint {
    const length = Math.hypot(point.x, point.z);
    if (length === 0) {
      return {
        x: 0,
        z: 0
      };
    }

    const ratio = map(length) / length;

    return {
      x: point.x * ratio,
      z: point.z * ratio
    };
  }
}
