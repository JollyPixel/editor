// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
const kChannels = 4;
const kOpaque = 255;
const kLinear = Float32Array.from(
  { length: 256 },
  (_, value) => decodeSRGB(value / kOpaque)
);
const kEncodeSteps = 4095;
const kEncode = Uint8Array.from(
  { length: kEncodeSteps + 1 },
  (_, step) => Math.round(encodeSRGB(step / kEncodeSteps) * kOpaque)
);

export interface PreviewReadback {
  data: THREE.TypedArray;
  width: number;
  height: number;
  bottomUp: boolean;
}

export class PreviewPixels {
  static fromReadback(
    readback: PreviewReadback
  ): PreviewPixels {
    const { data, width, height, bottomUp } = readback;
    const rowLength = width * kChannels;
    const stride = height > 1 ?
      (data.length - rowLength) / (height - 1) :
      rowLength;

    const pixels = new Uint8ClampedArray(rowLength * height);
    for (let row = 0; row < height; row++) {
      const source = (bottomUp ? height - 1 - row : row) * stride;
      pixels.set(
        data.subarray(source, source + rowLength),
        row * rowLength
      );
    }
    straightenAlpha(pixels);

    return new PreviewPixels(pixels, width, height);
  }

  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;

  constructor(
    data: Uint8ClampedArray<ArrayBuffer>,
    width: number,
    height: number
  ) {
    this.data = data;
    this.width = width;
    this.height = height;
  }

  toImageData(): ImageData {
    return new ImageData(this.data, this.width, this.height);
  }
}

function straightenAlpha(
  pixels: Uint8ClampedArray
): void {
  for (let alpha = kChannels - 1; alpha < pixels.length; alpha += kChannels) {
    const coverage = pixels[alpha];
    if (coverage === 0 || coverage === kOpaque) {
      continue;
    }

    const scale = kEncodeSteps * kOpaque / coverage;
    for (let channel = alpha - 3; channel < alpha; channel++) {
      pixels[channel] = kEncode[
        Math.min(kEncodeSteps, Math.round(kLinear[pixels[channel]] * scale))
      ];
    }
  }
}

function decodeSRGB(
  value: number
): number {
  return value < 0.04045 ?
    value * 0.0773993808 :
    Math.pow((value * 0.9478672986) + 0.0521327014, 2.4);
}

function encodeSRGB(
  value: number
): number {
  return value < 0.0031308 ?
    value * 12.92 :
    (1.055 * Math.pow(value, 0.41666)) - 0.055;
}
