// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server/backend";

// Import Internal Dependencies
import {
  bootStandalone,
  type OfflineProject
} from "#src/editor/bootStandalone.ts";
import type {
  EditorContext,
  EditorHandle
} from "#src/editor/EditorDefinition.ts";
import { EDITOR_STATE_ATTRIBUTE } from "#src/editor/mountStandalone.ts";
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
