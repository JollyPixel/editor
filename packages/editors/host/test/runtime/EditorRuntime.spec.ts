// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import type {
  Runtime,
  RuntimeLoadOptions
} from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";
import { HOST_PARAMS } from "#src/params/HostParams.ts";

function recordingRuntime(
  loads: Array<RuntimeLoadOptions>
): Runtime {
  const runtime: Pick<Runtime, "load"> = {
    load: (options = {}) => {
      loads.push(options);

      return Promise.resolve();
    }
  };

  return runtime as Runtime;
}

describe("EditorRuntime", () => {
  const scene = {} as Systems.Scene;

  test("the max-fps param overrides the editor fallback", async() => {
    const loads: Array<RuntimeLoadOptions> = [];
    const editorRuntime = new EditorRuntime(
      recordingRuntime(loads),
      HOST_PARAMS.read("?max-fps=10&samples=0")
    );

    await editorRuntime.load(scene, { maxFps: Infinity });

    assert.equal(loads[0].maxFps, 10);
    assert.equal(editorRuntime.samples, 0);
  });

  test("falls back to the editor maxFps without the param", async() => {
    const loads: Array<RuntimeLoadOptions> = [];
    const editorRuntime = new EditorRuntime(
      recordingRuntime(loads),
      HOST_PARAMS.read("")
    );

    await editorRuntime.load(scene, { maxFps: Infinity });

    assert.equal(loads[0].maxFps, Infinity);
    assert.equal(editorRuntime.samples, undefined);
  });
});
