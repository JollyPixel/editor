// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodePixelArtDocument,
  encodePixelArtDocument,
  InvalidPixelArtDocumentError,
  loadPixelArtDocument
} from "#src/asset/PixelArtDocument.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";

function bytes(
  payload: unknown
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

describe("PixelArtDocument", () => {
  test("round-trips pixels and size", () => {
    const source = new PixelBuffer({ size: { x: 3, y: 2 } });
    source.drawPixels(
      [{ x: 1, y: 1 }],
      {
        r: 10,
        g: 20,
        b: 30,
        a: 255
      }
    );

    const target = new PixelBuffer({ size: { x: 1, y: 1 } });
    loadPixelArtDocument(
      target,
      decodePixelArtDocument(encodePixelArtDocument(source))
    );

    assert.deepEqual(target.size(), { x: 3, y: 2 });
    assert.deepEqual(target.pixels(), source.pixels());
  });

  test("round-trips UV regions", () => {
    const source = new PixelBuffer({ size: { x: 4, y: 4 } });
    source.uvRegions.set({
      id: "region-1",
      color: "#ff0000",
      rect: {
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }
    });

    const target = new PixelBuffer({ size: { x: 4, y: 4 } });
    loadPixelArtDocument(
      target,
      decodePixelArtDocument(encodePixelArtDocument(source))
    );

    assert.deepEqual(
      [...target.uvRegions].map((region) => region.toJSON()),
      [...source.uvRegions].map((region) => region.toJSON())
    );
  });

  test("a document is complete state, not a patch", () => {
    const source = new PixelBuffer({ size: { x: 2, y: 2 } });
    const target = new PixelBuffer({ size: { x: 2, y: 2 } });
    target.uvRegions.set({
      id: "stale",
      color: "#00ff00",
      rect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      }
    });

    loadPixelArtDocument(
      target,
      decodePixelArtDocument(encodePixelArtDocument(source))
    );

    assert.deepEqual([...target.uvRegions], []);
  });

  test("rejects a payload that is not JSON", () => {
    assert.throws(
      () => decodePixelArtDocument(new TextEncoder().encode("{oops")),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects an unsupported version", () => {
    assert.throws(
      () => decodePixelArtDocument(bytes({
        version: 2,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a malformed size", () => {
    assert.throws(
      () => decodePixelArtDocument(bytes({
        version: 1,
        size: { x: 1.5, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a size the buffer would refuse", () => {
    const buffer = new PixelBuffer({
      size: { x: 2, y: 2 },
      maxSize: 4
    });

    assert.throws(
      () => loadPixelArtDocument(buffer, {
        version: 1,
        size: { x: 99, y: 2 },
        pixels: "",
        uvRegions: []
      }),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects pixels shorter than the declared size", () => {
    const buffer = new PixelBuffer({ size: { x: 2, y: 2 } });

    assert.throws(
      () => loadPixelArtDocument(buffer, {
        version: 1,
        size: { x: 2, y: 2 },
        pixels: "AAAA",
        uvRegions: []
      }),
      InvalidPixelArtDocumentError
    );
  });
});
