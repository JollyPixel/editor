// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  Runtime,
  type RuntimeLoadOptions,
  type RuntimeOptions
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

  test("renders on demand only in a frame or when the render param asks for it", async(t) => {
    const created: Array<RuntimeOptions | undefined> = [];
    const runtime = {
      world: {
        input: {
          keyboard: {
            addGuard: () => undefined
          }
        }
      }
    } as unknown as Runtime;
    t.mock.method(Runtime, "create", (_canvas: unknown, options?: RuntimeOptions) => {
      created.push(options);

      return Promise.resolve(runtime);
    });

    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read(""),
      framed: true
    });
    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read("?render=continuous"),
      framed: true
    });
    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read(""),
      framed: true,
      renderOnDemand: false
    });
    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read(""),
      framed: false
    });
    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read("?render=on-demand"),
      framed: false
    });

    assert.deepEqual(
      created.map((options) => options?.renderOnDemand),
      [true, false, false, false, true]
    );
  });

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
