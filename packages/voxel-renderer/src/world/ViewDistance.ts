// CONSTANTS
const kDefaultHysteresis = 1;

/**
 * Cylinder around the focus (`"xz"`, Minecraft-like) or sphere (`"sphere"`).
 */
export type ViewDistanceShape =
  | "xz"
  | "sphere";

export interface ViewDistanceOptions {
  /**
   * Radius in chunks; `Infinity` keeps every chunk meshed and visible.
   * @default Infinity
   */
  chunks?: number;
  /**
   * @default "xz"
   */
  shape?: ViewDistanceShape;
  /**
   * Extra radius in chunks a visible chunk keeps before it is dropped again,
   * so a chunk sitting on the border does not flip every tick.
   * @default 1
   */
  hysteresis?: number;
}

/**
 * Immutable chunk radius around a focus point, with separate enter and leave
 * radii. Distances are measured in world units between the focus and a chunk
 * center.
 */
export class ViewDistance {
  static readonly Unlimited = new ViewDistance();

  static from(
    value: number | ViewDistanceOptions | ViewDistance
  ): ViewDistance {
    if (value instanceof ViewDistance) {
      return value;
    }

    return new ViewDistance(
      typeof value === "number" ? { chunks: value } : value
    );
  }

  readonly chunks: number;
  readonly shape: ViewDistanceShape;
  readonly hysteresis: number;

  constructor(
    options: ViewDistanceOptions = {}
  ) {
    const {
      chunks = Infinity,
      shape = "xz",
      hysteresis = kDefaultHysteresis
    } = options;

    if (Number.isNaN(chunks) || chunks < 0) {
      throw new RangeError(
        `ViewDistance: chunks must be a positive number, got '${chunks}'.`
      );
    }
    if (Number.isNaN(hysteresis) || hysteresis < 0) {
      throw new RangeError(
        `ViewDistance: hysteresis must be a positive number, got '${hysteresis}'.`
      );
    }

    this.chunks = chunks;
    this.shape = shape;
    this.hysteresis = hysteresis;
  }

  get unlimited(): boolean {
    return this.chunks === Infinity;
  }

  admits(
    dx: number,
    dy: number,
    dz: number,
    chunkSize: number
  ): boolean {
    return this.#within(
      dx,
      dy,
      dz,
      this.chunks * chunkSize
    );
  }

  retains(
    dx: number,
    dy: number,
    dz: number,
    chunkSize: number
  ): boolean {
    return this.#within(
      dx,
      dy,
      dz,
      (this.chunks + this.hysteresis) * chunkSize
    );
  }

  #within(
    dx: number,
    dy: number,
    dz: number,
    radius: number
  ): boolean {
    if (radius === Infinity) {
      return true;
    }

    const squared = this.shape === "sphere" ?
      (dx * dx) + (dy * dy) + (dz * dz) :
      (dx * dx) + (dz * dz);

    return squared <= radius * radius;
  }

  equals(
    other: ViewDistance
  ): boolean {
    return this.chunks === other.chunks &&
      this.shape === other.shape &&
      this.hysteresis === other.hysteresis;
  }
}
