// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HOST_PARAMS,
  offlineWorkspaceQuery
} from "#src/params/HostParams.ts";

describe("HOST_PARAMS", () => {
  test("reads every host parameter", () => {
    assert.deepEqual(
      HOST_PARAMS.read(
        "?max-fps=10&samples=0&username=Ada&offline&workspace=%20demo%20"
      ),
      {
        maxFps: 10,
        samples: 0,
        username: "Ada",
        offline: true,
        workspace: "demo",
        render: undefined
      }
    );
  });

  test("absent parameters are undefined or false", () => {
    assert.deepEqual(HOST_PARAMS.read(""), {
      maxFps: undefined,
      samples: undefined,
      username: undefined,
      offline: false,
      workspace: undefined,
      render: undefined
    });
  });

  test("drops values the runtime cannot use", () => {
    assert.deepEqual(
      HOST_PARAMS.read("?max-fps=0&samples=1.5&username=%20&workspace="),
      {
        maxFps: undefined,
        samples: undefined,
        username: undefined,
        offline: false,
        workspace: undefined,
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

  test("offlineWorkspaceQuery reads back as an offline workspace", () => {
    const query = new URLSearchParams(offlineWorkspaceQuery("studio"));
    const params = HOST_PARAMS.read(`?${query}`);

    assert.equal(params.offline, true);
    assert.equal(params.workspace, "studio");
  });
});
