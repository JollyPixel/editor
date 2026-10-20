// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { mountStandalone } from "#src/editor/mountStandalone.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import {
  SHELL_MESSAGE_TYPE,
  ShellChannel,
  isShellCommand
} from "#src/launch/ShellChannel.ts";
import { IDENTITY_STORAGE_KEY } from "#src/session/SessionConnection.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import {
  ASSET_ID,
  OTHER_ASSET_ID,
  definition,
  offlineOptions,
  openServer,
  resetStandalonePage
} from "../helpers/standalone.ts";

describe("mountStandalone page query", () => {
  afterEach(resetStandalonePage);

  test("stores the username query param as the identity in dev", async() => {
    const server = await openServer();
    window.history.replaceState(null, "", "/?username=Ada");

    const editor = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      ...offlineOptions(server),
      dev: true
    });

    assert.equal(sessionStorage.getItem(IDENTITY_STORAGE_KEY), "Ada");

    editor.dispose();
    await server.close();
  });

  test("opens the session of the target query param while the launch is read", async() => {
    const server = await openServer();
    window.history.replaceState(null, "", `/?target=${ASSET_ID}`);
    const launch = Promise.withResolvers<EditorLaunch | undefined>();
    let connections = 0;

    const mounting = mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      sources: [{ read: () => launch.promise }],
      connect: () => {
        connections++;

        return server.connect();
      }
    });
    await setImmediate();
    assert.equal(connections, 1);

    launch.resolve(EditorLaunch.fromTarget(ASSET_ID));
    const editor = await mounting;
    assert.equal(connections, 1);
    assert.equal(editor.handle.session.target.record.id, ASSET_ID);

    editor.dispose();
    await server.close();
  });

  test("an early session reports its boot and unsaved changes to its shell", async() => {
    const server = await openServer();
    window.history.replaceState(null, "", `/?target=${ASSET_ID}`);
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: "http://studio.test"
    });

    const editor = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      ...offlineOptions(server),
      sources: [
        {
          read: () => Promise.resolve(EditorLaunch.fromTarget(ASSET_ID, shell))
        }
      ]
    });
    editor.handle.session.assets.emit("unsaved", true);

    assert.deepEqual(posted.filter(isShellCommand), [
      {
        type: SHELL_MESSAGE_TYPE,
        command: "editor-state",
        state: "booting"
      },
      {
        type: SHELL_MESSAGE_TYPE,
        command: "editor-state",
        state: "ready"
      },
      {
        type: SHELL_MESSAGE_TYPE,
        command: "unsaved",
        unsaved: true
      }
    ]);

    editor.dispose();
    await server.close();
  });

  test("views the tag of the page URL only for the target it names", async() => {
    const mounted: Array<string | null> = [];
    async function mountWithQuery(
      search: string
    ): Promise<void> {
      const server = await openServer();
      window.history.replaceState(null, "", search);
      const editor = await mountStandalone(definition((context) => {
        mounted.push(context.launch.tag);

        return Promise.resolve(editorHandle(context.session));
      }), offlineOptions(server));
      editor.dispose();
      await server.close();
    }

    await mountWithQuery(`/?target=${ASSET_ID}&tag=v1`);
    await mountWithQuery(`/?target=${OTHER_ASSET_ID}&tag=v1`);

    assert.deepEqual(mounted, ["v1", null]);
  });

  test("drops the early session but keeps its connection when the launch names another target", async() => {
    const server = await openServer();
    window.history.replaceState(null, "", `/?target=${ASSET_ID}`);
    let connections = 0;

    const editor = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), {
      sources: [
        {
          read: () => Promise.resolve(EditorLaunch.fromTarget(OTHER_ASSET_ID))
        }
      ],
      connect: () => {
        connections++;

        return server.connect();
      }
    });
    await setImmediate();

    const { session } = editor.handle;
    assert.equal(session.target.record.id, OTHER_ASSET_ID);
    assert.equal(session.assets.has(ASSET_ID), false);
    assert.equal(connections, 1);

    editor.dispose();
    await server.close();
  });

  test("ignores the username query param outside dev", async() => {
    const server = await openServer();
    window.history.replaceState(null, "", "/?username=Ada");

    const editor = await mountStandalone(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), offlineOptions(server));

    assert.equal(sessionStorage.getItem(IDENTITY_STORAGE_KEY), null);

    editor.dispose();
    await server.close();
  });
});
