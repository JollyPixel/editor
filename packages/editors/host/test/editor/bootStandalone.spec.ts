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
import {
  bootStandalone,
  type OfflineProject
} from "#src/editor/bootStandalone.ts";
import type {
  EditorContext,
  EditorHandle,
  RuntimeEditorContext
} from "#src/editor/EditorDefinition.ts";
import { HOST_PARAMS } from "#src/params/HostParams.ts";
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";
import { EDITOR_STATE_ATTRIBUTE } from "#src/editor/BootTrace.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { LAUNCH_MESSAGE_TYPE } from "#src/launch/ShellChannel.ts";
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
  const runtime: Pick<Runtime, "dispose"> = {
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

function frameInShell(): () => void {
  const parent = Object.assign(new MessageChannel().port1, {
    postMessage(): void {
      queueMicrotask(() => window.dispatchEvent(new MessageEvent("message", {
        source: parent,
        origin: location.origin,
        data: {
          type: LAUNCH_MESSAGE_TYPE,
          target: kAssetId
        }
      })));
    }
  });
  const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => parent
  });

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(window, "parent");
    }
    else {
      Object.defineProperty(window, "parent", descriptor);
    }
  };
}

describe("bootStandalone", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(EDITOR_STATE_ATTRIBUTE);
    document.body.replaceChildren();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  test("mounts on the in-page workspace with the offline query flag", async() => {
    window.history.replaceState(null, "", "/?offline");
    const mounted: Array<string> = [];

    const handle = await bootStandalone(definition(mounted), {
      sources: missingLaunch(),
      offline: project
    });
    handle.dispose();

    assert.deepEqual(mounted, [kAssetId]);
    assert.equal(document.body.querySelector("[data-action]"), null);
  });

  test("mounts offline without asking when forceOffline is set", async() => {
    const reads = { count: 0 };
    const mounted: Array<string> = [];

    const handle = await bootStandalone(definition(mounted), {
      sources: missingLaunch(reads),
      offline: project,
      forceOffline: true
    });
    handle.dispose();

    assert.equal(reads.count, 0);
    assert.deepEqual(mounted, [kAssetId]);
  });

  test("an offline page framed by a shell takes its launch and shell channel", async(context) => {
    context.after(frameInShell());
    const shells: Array<EditorContext["shell"]> = [];

    const handle = await bootStandalone({
      ...definition(),
      mount: (editorContext) => {
        shells.push(editorContext.shell);

        return Promise.resolve(editorHandle(editorContext.session));
      }
    }, {
      offline: project,
      forceOffline: true
    });
    handle.dispose();

    assert.equal(shells[0]?.origin, location.origin);
    assert.equal(document.body.querySelector("jolly-console"), null);
  });

  test("opens the offline workspace when the user picks it", async() => {
    const mounted: Array<string> = [];

    const pending = bootStandalone(definition(mounted), {
      sources: missingLaunch(),
      offline: project
    });
    await answerOffer("offline");
    const handle = await pending;
    handle.dispose();

    assert.deepEqual(mounted, [kAssetId]);
  });

  test("retries the online boot until the user cancels", async() => {
    const reads = { count: 0 };
    let projects = 0;

    const pending = bootStandalone(definition(), {
      sources: missingLaunch(reads),
      offline: () => {
        projects++;

        return project();
      }
    });
    await answerOffer("retry");
    await answerOffer("cancel");

    await assert.rejects(pending, LaunchNotFoundError);
    assert.equal(reads.count, 2);
    assert.equal(projects, 0);
  });

  test("creates the runtime once and mounts the offline fallback with it", async() => {
    const runtimes = recordingRuntimes();
    const received: Array<EditorRuntime> = [];

    const pending = bootStandalone({
      ...definition(),
      createRuntime: runtimes.create,
      mount: (context: RuntimeEditorContext) => {
        received.push(context.runtime);

        return Promise.resolve(editorHandle(context.session));
      }
    }, {
      sources: missingLaunch(),
      offline: project
    });
    await answerOffer("offline");
    const handle = await pending;
    handle.dispose();

    assert.equal(runtimes.created.length, 1);
    assert.deepEqual(received, runtimes.created);
    assert.equal(runtimes.disposed(), 0);
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
