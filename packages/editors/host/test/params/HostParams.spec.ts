// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { HOST_PARAMS } from "#src/params/HostParams.ts";

describe("HOST_PARAMS", () => {
  test("reads max-fps, samples and username", () => {
    assert.deepEqual(
      HOST_PARAMS.read("?max-fps=10&samples=0&username=Ada"),
      {
        maxFps: 10,
        samples: 0,
        username: "Ada"
      }
    );
  });

  test("absent parameters are undefined", () => {
    assert.deepEqual(HOST_PARAMS.read(""), {
      maxFps: undefined,
      samples: undefined,
      username: undefined
    });
  });

  test("drops values the runtime cannot use", () => {
    assert.deepEqual(
      HOST_PARAMS.read("?max-fps=0&samples=1.5&username=%20"),
      {
        maxFps: undefined,
        samples: undefined,
        username: undefined
      }
    );
    assert.equal(HOST_PARAMS.read("?max-fps=-5").maxFps, undefined);
    assert.equal(HOST_PARAMS.read("?samples=-1").samples, undefined);
  });
});
