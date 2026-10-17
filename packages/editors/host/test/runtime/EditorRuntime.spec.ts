// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  Runtime,
  type MetricsPanel,
  type MetricsPanelOptions,
  type RuntimeLoadOptions,
  type RuntimeOptions
} from "@jolly-pixel/runtime";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";
import { HOST_PARAMS } from "#src/params/HostParams.ts";
import { captureLogs } from "../helpers/logs.ts";

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

function recordCreates(
  t: TestContext
): Array<RuntimeOptions | undefined> {
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

  return created;
}

describe("EditorRuntime", () => {
  const scene = {} as Systems.Scene;

  test("renders on demand only in a frame or when the render param asks for it", async(t) => {
    const created = recordCreates(t);

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

  test("the gpu-time param turns on timestamps and keeps the editor renderer options", async(t) => {
    const created = recordCreates(t);
    const renderer = {
      webgpu: {
        antialias: false
      }
    };

    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read("?gpu-time"),
      framed: true,
      renderer
    });
    await EditorRuntime.create("canvas", {
      params: HOST_PARAMS.read(""),
      framed: true,
      renderer
    });

    assert.deepEqual(
      created.map((options) => options?.renderer?.webgpu),
      [
        {
          antialias: false,
          trackTimestamp: true
        },
        {
          antialias: false
        }
      ]
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

  test("mounts a hidden floating performance pane until disposed", () => {
    const mounts: MetricsPanelOptions[] = [];
    const runtime: Pick<Runtime, "mountMetricsPanel"> = {
      mountMetricsPanel: (options = {}) => {
        mounts.push(options);

        return Promise.withResolvers<MetricsPanel>().promise;
      }
    };
    const target = document.createElement("div");

    const editorRuntime = new EditorRuntime(
      runtime as Runtime,
      HOST_PARAMS.read(""),
      new MemoryStorageAdapter()
    );

    const dispose = editorRuntime.mountPerformancePane({
      target,
      storageKey: "test:performance",
      logger: captureLogs().logger
    });
    const [{ signal, ...options }] = mounts;

    assert.deepEqual(options, {
      target,
      floating: true,
      key: "performance",
      title: "Performance",
      storageKey: "test:performance",
      hidden: true
    });
    assert.equal(signal?.aborted, false);

    dispose();
    assert.equal(signal?.aborted, true);
  });
});
