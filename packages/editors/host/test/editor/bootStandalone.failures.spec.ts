// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server";
import type { Runtime } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { bootStandalone, type OfflineProject } from "#src/editor/bootStandalone.ts";
import type {
  EditorContext,
  EditorHandle,
  RuntimeEditorContext
} from "#src/editor/EditorDefinition.ts";
import { HOST_PARAMS } from "#src/params/HostParams.ts";
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";
import type { RuntimeWidgetHost } from "#src/runtime/RuntimeWidgets.ts";
import { EDITOR_STATE_ATTRIBUTE } from "#src/state/EditorState.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import type { LaunchSource } from "#src/launch/sources/LaunchSource.ts";
import { editorHandle } from "../helpers/editorHandle.ts";

// CONSTANTS
const kAssetId = "offline-target";

Object.defineProperty(globalThis, "navigator", {
  value: {},
  configurable: true
});

function project(): OfflineProject {
  return {
    handlers: [],
    seed: {
      "notes/readme.bin": {
        id: kAssetId,
        kind: BINARY_KIND,
        content: () => new Uint8Array([1])
      }
    }
  };
}

function definition(
  mounted: Array<string> = []
) {
  return {
    accepts: BINARY_KIND,
    identity: { title: "never prompted" },
    kinds: [],
    mount: (context: EditorContext): Promise<EditorHandle> => {
      mounted.push(context.launch.target.value);

      return Promise.resolve(editorHandle(context.session));
    }
  };
}

function recordingRuntimes() {
  const created: Array<EditorRuntime> = [];
  let disposed = 0;
  const runtime: Pick<Runtime, "dispose"> & RuntimeWidgetHost = {
    statsHud: null,
    viewHelper: null,
    metrics: {
      panel: null
    },
    dispose: () => {
      disposed++;
    }
  };

  return {
    created,
    disposed: () => disposed,
    create: (): Promise<EditorRuntime> => {
      const editorRuntime = new EditorRuntime(
        runtime as Runtime,
        HOST_PARAMS.read("")
      );
      created.push(editorRuntime);

      return Promise.resolve(editorRuntime);
    }
  };
}

function missingLaunch(
  reads: { count: number; } = { count: 0 }
): Array<LaunchSource> {
  return [
    {
      read: () => {
        reads.count++;

        return Promise.resolve(undefined);
      }
    }
  ];
}

async function answerOffer(
  action: string
): Promise<void> {
  for (;;) {
    const button = document.body.querySelector<HTMLElement>(
      `[data-action="${action}"]`
    );
    if (button !== null) {
      button.click();

      return;
    }
    await setImmediate();
  }
}

describe("bootStandalone", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(EDITOR_STATE_ATTRIBUTE);
    document.body.replaceChildren();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  test("disposes the runtime when the boot fails for good", async() => {
    const runtimes = recordingRuntimes();

    const pending = bootStandalone({
      ...definition(),
      createRuntime: runtimes.create,
      mount: (context: RuntimeEditorContext) => Promise.resolve(
        editorHandle(context.session)
      )
    }, {
      sources: missingLaunch(),
      offline: project
    });
    await answerOffer("cancel");

    await assert.rejects(pending, LaunchNotFoundError);
    await setImmediate();
    assert.equal(runtimes.disposed(), 1);
  });

  test("rethrows any other error without offering the offline workspace", async() => {
    const error = new Error("launch failed");

    await assert.rejects(
      bootStandalone(definition(), {
        sources: [
          {
            read: () => Promise.reject(error)
          }
        ],
        offline: project
      }),
      error
    );
    assert.equal(document.body.querySelector("[data-action]"), null);
  });
});
