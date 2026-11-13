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
const kMalformed = [
  "AQI",
  "AQ I",
  "AQID    ",
  "A=QI",
  "AQI*",
  "AQ-_"
];

function roundTripSuite(): void {
  test("round-trips bytes past one encoding chunk", () => {
    assert.deepEqual(decodeBase64(encodeBase64(kBytes)), kBytes);
  });

  test("decodes a view over a larger buffer", () => {
    const view = kBytes.subarray(1, 4);

    assert.equal(encodeBase64(view), "AQID");
    assert.deepEqual(decodeBase64("AQID"), view);
  });

  test("decodes padded text", () => {
    assert.deepEqual(decodeBase64("AQ=="), Uint8Array.of(1));
    assert.deepEqual(decodeBase64("AQI="), Uint8Array.of(1, 2));
  });

  for (const encoded of kMalformed) {
    test(`refuses "${encoded}"`, () => {
      assert.equal(decodeBase64(encoded), null);
    });
  }
}

type NativeGlobal = "Buffer" | "fromBase64" | "toBase64";

function withoutGlobals(
  names: ReadonlyArray<NativeGlobal>
): void {
  const owners = {
    Buffer: globalThis,
    fromBase64: Uint8Array,
    toBase64: Uint8Array.prototype
  };
  const saved = names.map((name) => Reflect.get(owners[name], name));
  before(() => {
    for (const name of names) {
      Reflect.deleteProperty(owners[name], name);
    }
  });
  after(() => {
    names.forEach((name, index) => {
      Reflect.set(owners[name], name, saved[index]);
    });
  });
}

describe("base64", () => {
  withoutGlobals(["toBase64"]);

  test("decodes with the native Uint8Array.fromBase64", () => {
    assert.equal(typeof Reflect.get(Uint8Array, "fromBase64"), "function");
  });

  roundTripSuite();

  test("encodeBase64Url uses the URL alphabet without padding", () => {
    const bytes = Uint8Array.of(0xfb, 0xff, 0xbf);

    assert.equal(encodeBase64(bytes), "+/+/");
    assert.equal(encodeBase64Url(bytes), "-_-_");
    assert.equal(encodeBase64Url(Uint8Array.of(1)), "AQ");
  });
});

describe("base64 without the native codec", () => {
  withoutGlobals(["fromBase64", "toBase64"]);

  roundTripSuite();
});

describe("base64 without the native codec or Buffer", () => {
  withoutGlobals(["fromBase64", "toBase64", "Buffer"]);

  roundTripSuite();
});
