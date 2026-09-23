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
  DEBUG_HANDLE,
  EDITOR_STATE_ATTRIBUTE,
  mountStandalone,
  type MountStandaloneOptions
} from "#src/editor/mountStandalone.ts";
import type {
  EditorContext,
  EditorHandle
} from "#src/editor/EditorDefinition.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { IDENTITY_STORAGE_KEY } from "#src/session/EditorSession.ts";
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";
import { editorHandle } from "../helpers/editorHandle.ts";

// CONSTANTS
const kAssetId = "debug-target";

function editorState(): string | null {
  return document.documentElement.getAttribute(EDITOR_STATE_ATTRIBUTE);
}

function openWorkspace(): Promise<OfflineWorkspace> {
  return OfflineWorkspace.open({
    handlers: [],
    seed: {
      "notes/readme.bin": {
        id: kAssetId,
        kind: BINARY_KIND,
        content: () => new Uint8Array([1])
      }
    }
  });
}

function offlineOptions(
  workspace: OfflineWorkspace
): MountStandaloneOptions {
  return {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(kAssetId))
      }
    ],
    connect: () => workspace.connect()
  };
}

function definition(
  mount: (context: EditorContext) => Promise<EditorHandle>
) {
  return {
    accepts: BINARY_KIND,
    identity: { title: "never prompted" },
    kinds: [],
    mount
  };
}

describe("mountStandalone", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(EDITOR_STATE_ATTRIBUTE);
    Reflect.deleteProperty(globalThis, DEBUG_HANDLE);
    Reflect.deleteProperty(globalThis, "hostTestHandle");
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  test("rejects before any session when no launch source names a target", async() => {
    let mounted = false;
    const editor = definition(() => {
      mounted = true;

      return Promise.reject(new Error("unreachable"));
    });

    await assert.rejects(
      mountStandalone(editor, {
        sources: [{ read: () => Promise.resolve(undefined) }]
      }),
      LaunchNotFoundError
    );
    assert.equal(mounted, false);
    assert.equal(editorState(), "failed");
  });

  test("walks booting to ready and publishes the handle once ready", async() => {
    const workspace = await openWorkspace();
    const ready = Promise.withResolvers<void>();
    const mounted = Promise.withResolvers<void>();

    let shell: unknown = "unset";
    const pending = mountStandalone(definition((context) => {
      shell = context.shell;
      mounted.resolve();

      return Promise.resolve(editorHandle(context.session, ready.promise));
    }), {
      ...offlineOptions(workspace),
      dev: true,
      debugHandle: "hostTestHandle"
    });
    assert.equal(editorState(), "booting");

    await mounted.promise;
    await setImmediate();
    assert.equal(editorState(), "booting");
    assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), undefined);

    ready.resolve();
    const handle = await pending;
    try {
      assert.equal(editorState(), "ready");
      assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), handle);
      assert.equal(Reflect.get(globalThis, "hostTestHandle"), handle);
      assert.equal(shell, null);
    }
    finally {
      handle.dispose();
      await workspace.close();
    }
  });

  test("publishes no handle outside dev", async() => {
    const workspace = await openWorkspace();

    const handle = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      ...offlineOptions(workspace),
      debugHandle: "hostTestHandle"
    });

    assert.equal(editorState(), "ready");
    assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), undefined);
    assert.equal(Reflect.get(globalThis, "hostTestHandle"), undefined);

    handle.dispose();
    await workspace.close();
  });

  test("marks the page failed when mount throws", async() => {
    const workspace = await openWorkspace();

    await assert.rejects(
      mountStandalone(definition(
        () => Promise.reject(new Error("mount failed"))
      ), offlineOptions(workspace)),
      /mount failed/
    );
    assert.equal(editorState(), "failed");

    await workspace.close();
  });

  test("disposes the handle and fails when ready rejects", async() => {
    const workspace = await openWorkspace();
    let disposed = false;

    await assert.rejects(
      mountStandalone(definition((context) => {
        const handle = editorHandle(
          context.session,
          Promise.reject(new Error("scene failed"))
        );

        return Promise.resolve({
          ...handle,
          dispose: () => {
            disposed = true;
            handle.dispose();
          }
        });
      }), {
        ...offlineOptions(workspace),
        dev: true
      }),
      /scene failed/
    );
    assert.equal(disposed, true);
    assert.equal(editorState(), "failed");
    assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), undefined);

    await workspace.close();
  });

  test("stores the username query param as the identity in dev", async() => {
    const workspace = await openWorkspace();
    window.history.replaceState(null, "", "/?username=Ada");

    const handle = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      ...offlineOptions(workspace),
      dev: true
    });

    assert.equal(sessionStorage.getItem(IDENTITY_STORAGE_KEY), "Ada");

    handle.dispose();
    await workspace.close();
  });

  test("ignores the username query param outside dev", async() => {
    const workspace = await openWorkspace();
    window.history.replaceState(null, "", "/?username=Ada");

    const handle = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), offlineOptions(workspace));

    assert.equal(sessionStorage.getItem(IDENTITY_STORAGE_KEY), null);

    handle.dispose();
    await workspace.close();
  });
});
