// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { StandaloneEditor } from "#src/boot/StandaloneEditor.ts";
import { readDebugLogger } from "#src/debug/readDebugLogger.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { parseFrameMessage } from "#src/shell/protocol.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import { shellChannel } from "../helpers/shell.ts";
import {
  ASSET_ID,
  definition,
  openServer,
  resetStandalonePage
} from "../helpers/standalone.ts";

describe("StandaloneEditor", () => {
  afterEach(resetStandalonePage);

  test("a retried mount reports each editor state to the shell once", async() => {
    const server = await openServer();
    const posted: unknown[] = [];
    const shell = shellChannel({
      port: { postMessage: (message) => posted.push(message) }
    });
    const sources = [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(ASSET_ID, shell))
      }
    ];
    const editor = new StandaloneEditor(definition(
      (context) => Promise.resolve(editorHandle(context.session))
    ), readDebugLogger());

    await assert.rejects(
      editor.mount({
        sources,
        connect: () => Promise.reject(new Error("server down"))
      }),
      /server down/
    );
    posted.length = 0;
    await editor.mount({
      sources,
      connect: () => server.connect()
    });

    assert.deepEqual(
      posted
        .map(parseFrameMessage)
        .map((message) => message?.type === "jolly-editor-state" && message.state),
      ["booting", "ready"]
    );

    editor.dispose();
    await server.close();
  });
});
