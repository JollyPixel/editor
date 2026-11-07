// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeBase64,
  encodeBase64,
  encodeBase64Url
} from "#src/index.ts";

// CONSTANTS
const kBytes = Uint8Array.from(
  { length: 0x8000 * 2 + 3 },
  (_, index) => index % 256
);

function roundTripSuite(): void {
  test("round-trips bytes past one encoding chunk", () => {
    assert.deepEqual(decodeBase64(encodeBase64(kBytes)), kBytes);
  });

  test("decodes a view over a larger buffer", () => {
    const view = kBytes.subarray(1, 4);

    assert.equal(encodeBase64(view), "AQID");
    assert.deepEqual(decodeBase64("AQID"), view);
  });

  for (const encoded of ["AQI", "AQ I", "A=QI", "AQI*", "AQ-_"]) {
    test(`refuses "${encoded}"`, () => {
      assert.equal(decodeBase64(encoded), null);
    });
  }
}

describe("base64", () => {
  roundTripSuite();

  test("encodeBase64Url uses the URL alphabet without padding", () => {
    const bytes = Uint8Array.of(0xfb, 0xff, 0xbf);

    assert.equal(encodeBase64(bytes), "+/+/");
    assert.equal(encodeBase64Url(bytes), "-_-_");
    assert.equal(encodeBase64Url(Uint8Array.of(1)), "AQ");
  });
});

describe("base64 without Buffer", () => {
  const buffer = globalThis.Buffer;
  before(() => {
    Reflect.deleteProperty(globalThis, "Buffer");
  });
  after(() => {
    globalThis.Buffer = buffer;
  });

  roundTripSuite();
});
