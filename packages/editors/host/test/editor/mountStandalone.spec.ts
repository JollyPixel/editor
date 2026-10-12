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

// Import Internal Dependencies
import { mountStandalone } from "#src/editor/mountStandalone.ts";
import { DEBUG_HANDLE } from "#src/editor/StandaloneEditor.ts";
import type { HostLogger } from "#src/debug/readDebugLogger.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import { captureLogs } from "../helpers/logs.ts";
import {
  ASSET_ID,
  definition,
  editorState,
  offlineOptions,
  openWorkspace,
  resetStandalonePage,
  trackedConnection
} from "../helpers/standalone.ts";

describe("mountStandalone", () => {
  afterEach(resetStandalonePage);

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
    const editor = await pending;
    try {
      assert.equal(editorState(), "ready");
      assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), editor.handle);
      assert.equal(Reflect.get(globalThis, "hostTestHandle"), editor.handle);
      assert.equal(shell, null);
    }
    finally {
      editor.dispose();
      await workspace.close();
    }
  });

  test("publishes no handle outside dev", async() => {
    const workspace = await openWorkspace();

    const editor = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      ...offlineOptions(workspace),
      debugHandle: "hostTestHandle"
    });

    assert.equal(editorState(), "ready");
    assert.equal(Reflect.get(globalThis, DEBUG_HANDLE), undefined);
    assert.equal(Reflect.get(globalThis, "hostTestHandle"), undefined);

    editor.dispose();
    await workspace.close();
  });

  test("a page kept in the back/forward cache leaves its rooms and reloads when restored", async(t) => {
    const workspace = await openWorkspace();
    const reload = t.mock.method(location, "reload", () => undefined);
    let disposed = 0;
    let destroyed = false;
    await mountStandalone(definition((context) => Promise.resolve({
      ...editorHandle(context.session),
      dispose: () => {
        disposed++;
      }
    })), {
      ...offlineOptions(workspace),
      connect: () => trackedConnection(workspace, () => {
        destroyed = true;
      })
    });

    window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted: true }));
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    await setImmediate();

    assert.equal(disposed, 1);
    assert.equal(destroyed, true);
    assert.ok(reload.mock.callCount() >= 1);
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

  test("traces each boot step in order", async() => {
    const workspace = await openWorkspace();
    const { logger, lines, metas } = captureLogs([
      "host.boot",
      "host.session"
    ]);

    let editorLogger: HostLogger | undefined;
    const editor = await mountStandalone(definition((context) => {
      editorLogger = context.logger;

      return Promise.resolve(editorHandle(context.session));
    }), {
      ...offlineOptions(workspace),
      logger
    });

    assert.deepEqual(lines, [
      "[DEBUG] [host.boot] state booting",
      "[DEBUG] [host.boot] launch started",
      "[DEBUG] [host.boot] launch source read",
      "[DEBUG] [host.boot] launch source read",
      "[DEBUG] [host.boot] launch done",
      "[DEBUG] [host.boot] session started",
      "[DEBUG] [host.session] catalog started",
      "[DEBUG] [host.session] catalog done",
      "[DEBUG] [host.session] target started",
      "[DEBUG] [host.session] target done",
      "[DEBUG] [host.boot] session done",
      "[DEBUG] [host.boot] mount started",
      "[DEBUG] [host.boot] mount done",
      "[DEBUG] [host.boot] ready started",
      "[DEBUG] [host.boot] ready done",
      "[DEBUG] [host.boot] state ready"
    ]);
    assert.deepEqual(metas[lines.indexOf(
      "[DEBUG] [host.session] target started"
    )], {
      kind: BINARY_KIND,
      id: ASSET_ID
    });
    assert.equal(editorLogger?.namespace, "editor");

    editor.dispose();
    await workspace.close();
  });

  test("names the boot step that failed", async() => {
    const workspace = await openWorkspace();
    const { logger, lines, metas } = captureLogs(["host.boot"]);
    const error = new Error("mount failed");

    await assert.rejects(
      mountStandalone(definition(() => Promise.reject(error)), {
        ...offlineOptions(workspace),
        logger
      }),
      error
    );
    assert.deepEqual(lines.slice(-2), [
      "[ERROR] [host.boot] mount failed",
      "[DEBUG] [host.boot] state failed"
    ]);
    assert.equal(metas.at(-2)?.error, error);

    await workspace.close();
  });

  test("disposes the session when the declared runtime cannot be created", async() => {
    const workspace = await openWorkspace();
    let mounted = false;
    let destroyed = false;

    await assert.rejects(
      mountStandalone({
        accepts: BINARY_KIND,
        identity: { title: "never prompted" },
        kinds: [],
        createRuntime: (logger) => EditorRuntime.create("#missing-canvas", {
          logger
        }),
        mount: () => {
          mounted = true;

          return Promise.reject(new Error("unreachable"));
        }
      }, {
        ...offlineOptions(workspace),
        connect: () => trackedConnection(workspace, () => {
          destroyed = true;
        })
      }),
      /missing-canvas/
    );
    assert.equal(mounted, false);
    assert.equal(destroyed, true);
    assert.equal(editorState(), "failed");

    await workspace.close();
  });
});
