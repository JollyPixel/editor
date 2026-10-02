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
import type { HostLogger } from "#src/debug/readDebugLogger.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { ShellChannel } from "#src/launch/ShellChannel.ts";
import { IDENTITY_STORAGE_KEY } from "#src/session/EditorSession.ts";
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import { captureLogs } from "../helpers/logs.ts";

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
    for (const element of document.querySelectorAll("jolly-console")) {
      element.remove();
    }
  });

  test("hands the editor the console mounted on the page", async() => {
    const workspace = await openWorkspace();

    const received: EditorContext["commands"][] = [];
    const handle = await mountStandalone(definition((context) => {
      received.push(context.commands);

      return Promise.resolve(editorHandle(context.session));
    }), offlineOptions(workspace));

    const elements = document.querySelectorAll("jolly-console");
    assert.equal(elements.length, 1);
    assert.equal(received.length, 1);
    assert.equal(elements[0].console, received[0]);
    assert.notEqual(
      received[0].registry.resolveVariable("theme"),
      undefined
    );
    assert.notEqual(
      received[0].registry.resolveVariable("density"),
      undefined
    );

    handle.dispose();
    await workspace.close();
  });

  test("leaves the console to the shell that framed the page", async() => {
    const workspace = await openWorkspace();
    const shell = new ShellChannel({
      port: { postMessage: () => undefined },
      origin: "http://studio.test"
    });

    const received: EditorContext["commands"][] = [];
    const handle = await mountStandalone(definition((context) => {
      received.push(context.commands);

      return Promise.resolve(editorHandle(context.session));
    }), {
      ...offlineOptions(workspace),
      sources: [
        {
          read: () => Promise.resolve(EditorLaunch.fromTarget(kAssetId, shell))
        }
      ]
    });

    assert.equal(document.querySelector("jolly-console"), null);
    assert.equal(received.length, 1);
    assert.equal(received[0].registry.resolveVariable("theme"), undefined);

    handle.dispose();
    await workspace.close();
  });

  test("removes the console when the boot fails", async() => {
    const workspace = await openWorkspace();

    await assert.rejects(
      mountStandalone(definition(
        () => Promise.reject(new Error("mount failed"))
      ), offlineOptions(workspace)),
      /mount failed/
    );
    assert.equal(document.querySelector("jolly-console"), null);

    await workspace.close();
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

  test("traces each boot step in order", async() => {
    const workspace = await openWorkspace();
    const { logger, lines, metas } = captureLogs([
      "host.boot",
      "host.session"
    ]);

    let editorLogger: HostLogger | undefined;
    const handle = await mountStandalone(definition((context) => {
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
      id: kAssetId
    });
    assert.equal(editorLogger?.namespace, "editor");

    handle.dispose();
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
