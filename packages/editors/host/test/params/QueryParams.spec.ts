// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { QueryParams } from "#src/params/QueryParams.ts";

describe("QueryParams", () => {
  test("reads flags, numbers and strings by parameter name", () => {
    const params = new QueryParams((query) => {
      return {
        offline: query.flag("offline"),
        maxFps: query.number("max-fps"),
        samples: query.number("samples", 4),
        mode: query.string("mode")
      };
    }).read("?offline&max-fps=10&samples=oops");

    assert.deepEqual(params, {
      offline: true,
      maxFps: 10,
      samples: 4,
      mode: undefined
    });
  });

  test("absent flags are false", () => {
    assert.deepEqual(
      new QueryParams((query) => {
        return { offline: query.flag("offline") };
      }).read(""),
      { offline: false }
    );
  });
});
