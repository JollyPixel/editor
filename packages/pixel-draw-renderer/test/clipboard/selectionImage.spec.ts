// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import {
  decodeRasterBlob,
  encodeSelectionPng
} from "#src/clipboard/selectionImage.ts";
import type { SelectionSnapshot } from "#src/clipboard/types.ts";

// CONSTANTS
// RGB under a low alpha: a canvas round-trip would return (170, 85, 85, 3).
const kFragilePixels = [
  200, 100, 50, 3,
  0, 0, 0, 0
];

function installBitmapDecoder(): void {
  Object.assign(globalThis, {
    createImageBitmap: async() => {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 1;

      return Object.assign(canvas, {
        close: () => undefined
      });
    }
  });
}

describe("decodeRasterBlob", () => {
  test("converts the codec's flat samples to the clipboard's RGBA8 objects", async() => {
    Object.assign(globalThis, {
      ImageDecoder: class {
        completed = Promise.resolve();

        async decode() {
          return {
            image: {
              codedWidth: 2,
              codedHeight: 1,
              allocationSize: () => kFragilePixels.length,
              copyTo: async(buffer: Uint8ClampedArray) => {
                buffer.set(kFragilePixels);
              },
              close: () => undefined
            }
          };
        }

        close(): void {
          // no-op
        }
      }
    });
    installBitmapDecoder();

    try {
      const image = await decodeRasterBlob(
        new Blob(["png"], { type: "image/png" })
      );

      assert.deepStrictEqual(image, {
        width: 2,
        height: 1,
        pixels: [
          {
            r: 200,
            g: 100,
            b: 50,
            a: 3
          },
          {
            r: 0,
            g: 0,
            b: 0,
            a: 0
          }
        ]
      });
    }
    finally {
      Reflect.deleteProperty(globalThis, "ImageDecoder");
      Reflect.deleteProperty(globalThis, "createImageBitmap");
    }
  });
});

describe("encodeSelectionPng", () => {
  function snapshot(): SelectionSnapshot {
    return {
      rect: {
        x: 0,
        y: 0,
        width: 2,
        height: 1
      },
      pixels: [
        {
          r: 200,
          g: 100,
          b: 50,
          a: 3
        },
        {
          r: 10,
          g: 20,
          b: 30,
          a: 255
        }
      ],
      mask: [true, false]
    };
  }

  test("writes low-alpha pixels exactly, with masked ones at alpha 0", async() => {
    const blob = await encodeSelectionPng(snapshot());
    const decoded = await decodePng(
      new Uint8Array(await blob.arrayBuffer())
    );

    assert.strictEqual(blob.type, "image/png");
    assert.strictEqual(decoded.width, 2);
    assert.strictEqual(decoded.height, 1);
    assert.deepStrictEqual([...decoded.data], [
      200, 100, 50, 3,
      10, 20, 30, 0
    ]);
  });
});
