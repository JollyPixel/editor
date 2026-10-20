// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HOST_PARAMS,
  offlineQuery
} from "#src/params/HostParams.ts";

describe("HOST_PARAMS", () => {
  test("reads every host parameter", () => {
    assert.deepEqual(
      HOST_PARAMS.read(
        "?max-fps=10&samples=0&gpu-time&username=Ada&offline=%20demo%20"
      ),
      {
        maxFps: 10,
        samples: 0,
        gpuTime: true,
        username: "Ada",
        offline: {
          name: "demo"
        },
        render: undefined
      }
    );
  });

  test("absent parameters are undefined or false", () => {
    assert.deepEqual(HOST_PARAMS.read(""), {
      maxFps: undefined,
      samples: undefined,
      gpuTime: false,
      username: undefined,
      offline: undefined,
      render: undefined
    });
  });

  test("drops values the runtime cannot use", () => {
    assert.deepEqual(
      HOST_PARAMS.read("?max-fps=0&samples=1.5&username=%20&offline=%20"),
      {
        maxFps: undefined,
        samples: undefined,
        gpuTime: false,
        username: undefined,
        offline: {
          name: undefined
        },
        render: undefined
      }
    );
    assert.equal(HOST_PARAMS.read("?max-fps=-5").maxFps, undefined);
    assert.equal(HOST_PARAMS.read("?samples=-1").samples, undefined);
  });

  test("render reads continuous or on-demand only", () => {
    assert.equal(HOST_PARAMS.read("?render=continuous").render, "continuous");
    assert.equal(HOST_PARAMS.read("?render=%20on-demand").render, "on-demand");
    assert.equal(HOST_PARAMS.read("?render=always").render, undefined);
  });

  test("offlineQuery reads back as named offline data", () => {
    const query = new URLSearchParams(offlineQuery("studio"));
    const params = HOST_PARAMS.read(`?${query}`);

    assert.deepEqual(params.offline, {
      name: "studio"
    });
  });
});
