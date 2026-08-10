// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeRasterBlob,
  decodeRasterCanvas
} from "#src/clipboard/selectionImage.ts";
import { canvasPixels } from "../fixtures/canvas.ts";

// CONSTANTS
// RGB under a low alpha: a canvas round-trip would return (170, 85, 85, 3).
const kFragilePixels = [
  200, 100, 50, 3,
  0, 0, 0, 0
];

interface FrameStub {
  codedWidth: number;
  codedHeight: number;
  allocationSize: (options: unknown) => number;
  copyTo: (buffer: Uint8ClampedArray, options: unknown) => Promise<void>;
  close: () => void;
}

interface DecoderStubOptions {
  samples?: number[];
  width?: number;
  height?: number;
  /**
   * Simulates a padded plane layout, which the RGBA fast path cannot use.
   */
  allocationSize?: number;
  throwOnConstruct?: boolean;
  throwOnDecode?: boolean;
}

let closedDecoders = 0;
let closedFrames = 0;

function installImageDecoder(
  options: DecoderStubOptions = {}
): void {
  const {
    samples = kFragilePixels,
    width = 2,
    height = 1
  } = options;

  class ImageDecoderStub {
    completed = Promise.resolve();

    constructor() {
      if (options.throwOnConstruct) {
        throw new Error("unsupported type");
      }
    }

    async decode(): Promise<{ image: FrameStub; }> {
      if (options.throwOnDecode) {
        throw new Error("decode failed");
      }

      return {
        image: {
          codedWidth: width,
          codedHeight: height,
          allocationSize: () => options.allocationSize ?? samples.length,
          copyTo: async(buffer: Uint8ClampedArray) => {
            buffer.set(samples);
          },
          close: () => {
            closedFrames++;
          }
        }
      };
    }

    close(): void {
      closedDecoders++;
    }
  }

  Object.assign(globalThis, { ImageDecoder: ImageDecoderStub });
}

function installBitmapDecoder(
  received: { options?: ImageBitmapOptions; } = {}
): void {
  Object.assign(globalThis, {
    createImageBitmap: async(
      _blob: Blob,
      bitmapOptions?: ImageBitmapOptions
    ) => {
      received.options = bitmapOptions;
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;

      return Object.assign(canvas, {
        close: () => undefined
      });
    }
  });
}

function clearDecoders(): void {
  Reflect.deleteProperty(globalThis, "ImageDecoder");
  Reflect.deleteProperty(globalThis, "createImageBitmap");
}

describe("selectionImage decoding", () => {
  afterEach(() => {
    clearDecoders();
    closedDecoders = 0;
    closedFrames = 0;
  });

  test("prefers WebCodecs, returning the file's own samples untouched", async() => {
    installImageDecoder();

    const image = await decodeRasterBlob(
      new Blob(["png"], { type: "image/png" })
    );

    assert.deepStrictEqual(image, {
      width: 2,
      height: 1,
      pixels: [
        { r: 200, g: 100, b: 50, a: 3 },
        { r: 0, g: 0, b: 0, a: 0 }
      ]
    });
  });

  test("releases the decoder and the frame", async() => {
    installImageDecoder();

    await decodeRasterBlob(new Blob(["png"], { type: "image/png" }));

    assert.strictEqual(closedDecoders, 1);
    assert.strictEqual(closedFrames, 1);
  });

  test("falls back to the canvas decoder, asking it not to alter the pixels", async() => {
    const received: { options?: ImageBitmapOptions; } = {};
    installBitmapDecoder(received);

    await decodeRasterBlob(new Blob(["png"], { type: "image/png" }));

    assert.deepStrictEqual(received.options, {
      premultiplyAlpha: "none",
      colorSpaceConversion: "none"
    });
  });

  test("falls back when the codec rejects the type", async() => {
    installImageDecoder({ throwOnConstruct: true });
    const received: { options?: ImageBitmapOptions; } = {};
    installBitmapDecoder(received);

    const image = await decodeRasterBlob(
      new Blob(["x"], { type: "image/x-unknown" })
    );

    assert.strictEqual(image.width, 2);
    assert.ok(received.options, "the canvas decoder ran");
  });

  test("falls back when decoding throws", async() => {
    installImageDecoder({ throwOnDecode: true });
    const received: { options?: ImageBitmapOptions; } = {};
    installBitmapDecoder(received);

    await decodeRasterBlob(new Blob(["png"], { type: "image/png" }));

    assert.ok(received.options, "the canvas decoder ran");
  });

  test("falls back when the frame would need a padded stride", async() => {
    installImageDecoder({ allocationSize: 64 });
    const received: { options?: ImageBitmapOptions; } = {};
    installBitmapDecoder(received);

    await decodeRasterBlob(new Blob(["png"], { type: "image/png" }));

    assert.ok(received.options, "the canvas decoder ran");
  });

  test("decodeRasterCanvas writes exact samples rather than compositing them", async() => {
    installImageDecoder();

    const canvas = await decodeRasterCanvas(
      new Blob(["png"], { type: "image/png" })
    );

    assert.strictEqual(canvas.width, 2);
    assert.strictEqual(canvas.height, 1);
    assert.deepStrictEqual(
      [...canvasPixels(canvas)],
      kFragilePixels
    );
  });
});
