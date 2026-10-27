// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  InvalidAssetFileError,
  JsonAssetFile
} from "#src/index.ts";

class InvalidEntryError extends Error {}

// CONSTANTS
const kFile = new JsonAssetFile({
  kind: "sample",
  schema: z.object({
    names: z.optional(z.array(z.string()))
  }),
  expand: ({ names = [] }) => {
    return { names: [...names] };
  },
  compact: ({ names }: { names: string[]; }) => (names.length === 0 ? {} : { names }),
  isInvalid: (error) => error instanceof InvalidEntryError
});

function bytes(
  text: string
): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("JsonAssetFile", () => {
  test("stores the compact form and expands it back", () => {
    const empty = kFile.encode({ names: [] });

    assert.equal(new TextDecoder().decode(empty), "{}");
    assert.deepEqual(kFile.decode(empty), { names: [] });
    assert.deepEqual(kFile.decode(kFile.encode({ names: ["a"] })), { names: ["a"] });
  });

  test("refuses content that is not JSON or not a file", () => {
    assert.throws(() => kFile.decode(bytes("{")), InvalidAssetFileError);
    assert.throws(() => kFile.decode(bytes("{\"names\":3}")), InvalidAssetFileError);
  });

  test("reports an invalid entry met while loading as an invalid file", () => {
    assert.throws(
      () => kFile.load(bytes("{}"), () => {
        throw new InvalidEntryError("node a is listed twice");
      }),
      InvalidAssetFileError
    );
  });

  test("lets any other load failure through", () => {
    assert.throws(
      () => kFile.load(bytes("{}"), () => {
        throw new RangeError("bug");
      }),
      RangeError
    );
  });
});
