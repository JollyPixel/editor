// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kChannels = 4;
const kSrgbToLinear = Float32Array.from(
  { length: 256 },
  (_, value) => srgbToLinear(value / 255)
);
const kTables = new WeakMap<THREE.Texture, AtlasAverages>();

interface AtlasPixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/**
 * Summed-area table of an atlas: texel `(i, j)` holds the sums over every
 * source texel left of column `i` and below row `j`, with `v` pointing up.
 * RGB is linear and premultiplied by alpha; A is the alpha sum. Four texels
 * give the average colour of any integer texel rect.
 */
export class AtlasAverages {
  /**
   * Table shared by every atlas drawing `source`, or null when its pixels
   * cannot be read (no 2D canvas, cross-origin image, unloaded image).
   */
  static of(
    source: THREE.Texture
  ): AtlasAverages | null {
    const cached = kTables.get(source);
    if (cached !== undefined) {
      return cached;
    }

    const pixels = readPixels(source);
    if (pixels === null) {
      return null;
    }

    const table = new AtlasAverages(source, pixels);
    kTables.set(source, table);

    return table;
  }

  /**
   * Table already built for `source`, without building one.
   */
  static peek(
    source: THREE.Texture
  ): AtlasAverages | undefined {
    return kTables.get(source);
  }

  readonly texture: THREE.DataTexture;

  #source: THREE.Texture;
  #version: number;
  #table: Float32Array;
  #stride: number;

  /**
   * Prefer `AtlasAverages.of()`, which shares one table per source texture.
   */
  constructor(
    source: THREE.Texture,
    pixels: AtlasPixels
  ) {
    this.#source = source;
    this.#version = source.version;
    this.#stride = pixels.width + 1;
    this.#table = tableFor(pixels);

    this.texture = new THREE.DataTexture(
      this.#table,
      pixels.width + 1,
      pixels.height + 1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.#fill(pixels);

    source.addEventListener("dispose", this.#onSourceDisposed);
  }

  /**
   * Rebuilds the table when the source texture was updated since the last
   * build. Returns whether it did.
   */
  refresh(): boolean {
    if (this.#source.version === this.#version) {
      return false;
    }
    this.#version = this.#source.version;

    const pixels = readPixels(this.#source);
    if (pixels === null) {
      return false;
    }

    const { image } = this.texture;
    if (
      image.width !== pixels.width + 1 ||
      image.height !== pixels.height + 1
    ) {
      // A resized GPU texture is only reallocated after a dispose.
      this.texture.dispose();
      this.#stride = pixels.width + 1;
      this.#table = tableFor(pixels);
      this.texture.image = {
        data: this.#table,
        width: pixels.width + 1,
        height: pixels.height + 1
      };
    }
    this.#fill(pixels);

    return true;
  }

  /**
   * Average of the texel rect `[x0, x1) × [y0, y1)`, with `y` counted from
   * the bottom row. RGB is the alpha-weighted linear colour.
   */
  average(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): [r: number, g: number, b: number, a: number] {
    const sum = [0, 0, 0, 0];
    this.#accumulate(sum, x1, y1, 1);
    this.#accumulate(sum, x0, y1, -1);
    this.#accumulate(sum, x1, y0, -1);
    this.#accumulate(sum, x0, y0, 1);

    const area = Math.max((x1 - x0) * (y1 - y0), 1);
    const alpha = sum[3];
    const weight = alpha > 0 ? alpha : 1;

    return [
      sum[0] / weight,
      sum[1] / weight,
      sum[2] / weight,
      alpha / area
    ];
  }

  dispose(): void {
    this.#source.removeEventListener("dispose", this.#onSourceDisposed);
    kTables.delete(this.#source);
    this.texture.dispose();
  }

  #onSourceDisposed = (): void => {
    this.dispose();
  };

  #accumulate(
    sum: number[],
    x: number,
    y: number,
    sign: number
  ): void {
    const offset = ((y * this.#stride) + x) * kChannels;
    for (let channel = 0; channel < kChannels; channel++) {
      sum[channel] += sign * this.#table[offset + channel];
    }
  }

  #fill(
    pixels: AtlasPixels
  ): void {
    const table = this.#table;
    const stride = this.#stride;
    const { data, width, height } = pixels;
    const linear = this.#source.colorSpace === THREE.SRGBColorSpace;
    const flip = this.#source.flipY;

    for (let y = 0; y < height; y++) {
      const sourceRow = flip ? height - 1 - y : y;
      const row = (y + 1) * stride * kChannels;
      const below = y * stride * kChannels;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let x = 0; x < width; x++) {
        const texel = ((sourceRow * width) + x) * kChannels;
        const alpha = data[texel + 3] / 255;
        r += channel(data[texel], linear) * alpha;
        g += channel(data[texel + 1], linear) * alpha;
        b += channel(data[texel + 2], linear) * alpha;
        a += alpha;

        const cell = row + ((x + 1) * kChannels);
        const cellBelow = below + ((x + 1) * kChannels);
        table[cell] = table[cellBelow] + r;
        table[cell + 1] = table[cellBelow + 1] + g;
        table[cell + 2] = table[cellBelow + 2] + b;
        table[cell + 3] = table[cellBelow + 3] + a;
      }
    }

    this.texture.needsUpdate = true;
  }
}

/**
 * Zeroed table; row 0 and column 0 stay zero across fills.
 */
function tableFor(
  pixels: AtlasPixels
): Float32Array {
  return new Float32Array(
    (pixels.width + 1) * (pixels.height + 1) * kChannels
  );
}

function srgbToLinear(
  value: number
): number {
  return value < 0.04045 ?
    value / 12.92 :
    ((value + 0.055) / 1.055) ** 2.4;
}

function channel(
  value: number,
  linear: boolean
): number {
  return linear ? kSrgbToLinear[value] : value / 255;
}

/**
 * Reads RGBA8 texels in image row order.
 */
function readPixels(
  source: THREE.Texture
): AtlasPixels | null {
  const image: unknown = source.image;
  if (!isSized(image)) {
    return null;
  }

  if (
    "data" in image &&
    (image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)
  ) {
    return image.data.length >= image.width * image.height * kChannels ?
      {
        data: image.data,
        width: image.width,
        height: image.height
      } :
      null;
  }

  const context = scratchContext(image.width, image.height);
  if (context === null) {
    return null;
  }

  try {
    context.drawImage(image as CanvasImageSource, 0, 0);

    return context.getImageData(0, 0, image.width, image.height);
  }
  catch {
    return null;
  }
}

function isSized(
  image: unknown
): image is { width: number; height: number; } {
  if (typeof image !== "object" || image === null) {
    return false;
  }

  const { width, height } = image as Partial<AtlasPixels>;

  return typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0;
}

function scratchContext(
  width: number,
  height: number
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
  const settings: CanvasRenderingContext2DSettings = {
    willReadFrequently: true
  };

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height).getContext("2d", settings);
  }
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas.getContext("2d", settings);
}
