// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

// Import Internal Dependencies
import {
  decodeRaster,
  decodeRasterCanvas
} from "#src/raster/decodeRaster.ts";
import {
  chunk,
  header,
  png,
  FRAGILE_PIXELS
} from "../fixtures/png.ts";
import { canvasPixels } from "../fixtures/canvas.ts";

interface FrameStub {
  codedWidth: number;
  codedHeight: number;
  allocationSize: (options: unknown) => number;
  copyTo: (buffer: Uint8ClampedArray, options: unknown) => Promise<void>;
  close: () => void;
}

interface DecoderStubOptions {
  allocationSize?: number;
  throwOnConstruct?: boolean;
  throwOnDecode?: boolean;
  throwOnCopy?: boolean;
}

interface DecoderProbe {
  closedDecoders: number;
  closedFrames: number;
}

interface BitmapProbe {
  options?: ImageBitmapOptions;
}

function installImageDecoder(
  options: DecoderStubOptions = {}
): DecoderProbe {
  const probe: DecoderProbe = {
    closedDecoders: 0,
    closedFrames: 0
  };

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

      let closed = false;

      return {
        image: {
          codedWidth: 2,
          codedHeight: 1,
          allocationSize: () => (
            options.allocationSize ?? FRAGILE_PIXELS.length
          ),
          copyTo: async(buffer: Uint8ClampedArray) => {
            await Promise.resolve();
            if (closed) {
              throw new Error("frame closed during copy");
            }
            if (options.throwOnCopy) {
              throw new Error("copy failed");
            }
            buffer.set(FRAGILE_PIXELS);
          },
          close: () => {
            closed = true;
            probe.closedFrames++;
          }
        }
      };
    }

    close(): void {
      probe.closedDecoders++;
    }
  }

  Object.assign(globalThis, { ImageDecoder: ImageDecoderStub });

  return probe;
}

function installBitmapDecoder(): BitmapProbe {
  const probe: BitmapProbe = {};

  Object.assign(globalThis, {
    createImageBitmap: async(
      _blob: Blob,
      bitmapOptions?: ImageBitmapOptions
    ) => {
      probe.options = bitmapOptions;
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;

      return Object.assign(canvas, {
        close: () => undefined
      });
    }
  });

  return probe;
}

function fragilePngBlob(): Blob {
  const payload = png([
    header(2, 1, 6),
    chunk("IDAT", deflateSync(Buffer.from([0, ...FRAGILE_PIXELS])))
  ]);

  return new Blob([payload], { type: "image/png" });
}

function opaqueBlob(): Blob {
  return new Blob(["x"], { type: "image/x-unknown" });
}

function clearDecoders(): void {
  Reflect.deleteProperty(globalThis, "ImageDecoder");
  Reflect.deleteProperty(globalThis, "createImageBitmap");
}

describe("decodeRaster", () => {
  afterEach(clearDecoders);

  test("prefers WebCodecs, returning the file's own samples untouched", async() => {
    installImageDecoder();

    const image = await decodeRaster(opaqueBlob());

    assert.strictEqual(image.width, 2);
    assert.strictEqual(image.height, 1);
    assert.deepStrictEqual([...image.data], FRAGILE_PIXELS);
  });

  test("releases the decoder and the frame", async() => {
    const probe = installImageDecoder();

    await decodeRaster(opaqueBlob());

    assert.deepStrictEqual(probe, {
      closedDecoders: 1,
      closedFrames: 1
    });
  });

  test("falls back to the canvas decoder, asking it not to alter the pixels", async() => {
    const bitmap = installBitmapDecoder();

    await decodeRaster(opaqueBlob());

    assert.deepStrictEqual(bitmap.options, {
      premultiplyAlpha: "none",
      colorSpaceConversion: "none"
    });
  });

  const fallbackCases: {
    name: string;
    decoder?: DecoderStubOptions;
    blob?: Blob;
  }[] = [
    {
      name: "the codec rejects the type",
      decoder: { throwOnConstruct: true }
    },
    {
      name: "decoding throws",
      decoder: { throwOnDecode: true }
    },
    {
      name: "the frame would need a padded stride",
      decoder: { allocationSize: 64 }
    },
    {
      name: "copying the frame fails",
      decoder: { throwOnCopy: true }
    },
    {
      name: "the PNG bytes are unreadable",
      blob: new Blob(["png"], { type: "image/png" })
    }
  ];

  for (const { name, decoder, blob = opaqueBlob() } of fallbackCases) {
    test(`falls back to the canvas decoder when ${name}`, async() => {
      if (decoder) {
        installImageDecoder(decoder);
      }
      const bitmap = installBitmapDecoder();

      const image = await decodeRaster(blob);

      assert.strictEqual(image.width, 2);
      assert.ok(bitmap.options, "the canvas decoder ran");
    });
  }

  test("decodes PNG losslessly without WebCodecs, skipping the canvas", async() => {
    const bitmap = installBitmapDecoder();

    const image = await decodeRaster(fragilePngBlob());

    assert.strictEqual(image.width, 2);
    assert.strictEqual(image.height, 1);
    assert.deepStrictEqual([...image.data], FRAGILE_PIXELS);
    assert.strictEqual(
      bitmap.options,
      undefined,
      "the canvas decoder never ran"
    );
  });
});

describe("decodeRasterCanvas", () => {
  afterEach(clearDecoders);

  test("puts the exactly decoded samples on a canvas of the image size", async() => {
    installBitmapDecoder();

    const canvas = await decodeRasterCanvas(fragilePngBlob());

    assert.strictEqual(canvas.width, 2);
    assert.strictEqual(canvas.height, 1);
    assert.deepStrictEqual(
      [...canvasPixels(canvas)],
      FRAGILE_PIXELS
    );
  });
});
