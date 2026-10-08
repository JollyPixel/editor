// CONSTANTS
export const TILE_SIZE = 32;

export type Rgba = readonly [r: number, g: number, b: number, a: number];

export class Palette {
  readonly #levels: Rgba[];

  constructor(
    ...hexes: string[]
  ) {
    this.#levels = hexes.map(parseHex);
  }

  get size(): number {
    return this.#levels.length;
  }

  mix(
    level: number
  ): Rgba {
    const low = this.#clamp(Math.floor(level));
    const high = this.#clamp(low + 1);
    const t = Math.max(0, Math.min(1, level - low));
    const [r0, g0, b0] = this.#levels[low];
    const [r1, g1, b1] = this.#levels[high];

    return [lerp(r0, r1, t), lerp(g0, g1, t), lerp(b0, b1, t), 255];
  }

  #clamp(
    index: number
  ): number {
    return Math.max(0, Math.min(this.#levels.length - 1, index));
  }
}

export const TRANSPARENT: Rgba = [0, 0, 0, 0];

export function shade(
  [r, g, b, a]: Rgba,
  factor: number
): Rgba {
  return [r * factor, g * factor, b * factor, a];
}

export class TileCanvas {
  readonly size: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  readonly seed: number;

  constructor(
    seed: number,
    size = TILE_SIZE
  ) {
    this.seed = seed;
    this.size = size;
    this.pixels = new Uint8ClampedArray(size * size * 4);
  }

  wrap(
    coordinate: number
  ): number {
    return ((coordinate % this.size) + this.size) % this.size;
  }

  set(
    u: number,
    v: number,
    [r, g, b, a]: Rgba
  ): void {
    this.pixels.set([r, g, b, a], this.#offset(u, v));
  }

  get(
    u: number,
    v: number
  ): Rgba {
    const offset = this.#offset(u, v);
    const [r, g, b, a] = this.pixels.subarray(offset, offset + 4);

    return [r, g, b, a];
  }

  noise(
    u: number,
    v: number,
    salt = 0
  ): number {
    return hash(this.wrap(u), this.wrap(v), salt, this.seed);
  }

  smoothNoise(
    u: number,
    v: number,
    period: number,
    salt = 0
  ): number {
    const cells = this.size / period;
    const x = u / period;
    const y = v / period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const corner = (cx: number, cy: number) => hash(
      ((cx % cells) + cells) % cells,
      ((cy % cells) + cells) % cells,
      salt,
      this.seed + period
    );

    return lerp(
      lerp(corner(x0, y0), corner(x0 + 1, y0), tx),
      lerp(corner(x0, y0 + 1), corner(x0 + 1, y0 + 1), tx),
      ty
    );
  }

  each(
    paint: (u: number, v: number) => void
  ): void {
    for (let v = 0; v < this.size; v++) {
      for (let u = 0; u < this.size; u++) {
        paint(u, v);
      }
    }
  }

  #offset(
    u: number,
    v: number
  ): number {
    return ((this.wrap(v) * this.size) + this.wrap(u)) * 4;
  }
}

export type TilePainter = (tile: TileCanvas) => void;

export function hash(
  x: number,
  y: number,
  z: number,
  seed: number
): number {
  let h = Math.imul(x | 0, 0x27D4EB2D) ^
    Math.imul(y | 0, 0x165667B1) ^
    Math.imul(z | 0, 0x1B873593) ^
    Math.imul(seed | 0, 0x68E31DA4);
  h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function parseHex(
  hex: string
): Rgba {
  const value = Number.parseInt(hex.slice(1), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function smooth(
  t: number
): number {
  return t * t * (3 - (2 * t));
}

function lerp(
  a: number,
  b: number,
  t: number
): number {
  return a + ((b - a) * t);
}
