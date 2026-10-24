// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { mountStandalone } from "#src/boot/mountStandalone.ts";
import type { EditorContext } from "#src/boot/EditorDefinition.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { ShellChannel } from "#src/shell/ShellChannel.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import {
  ASSET_ID,
  definition,
  offlineOptions,
  openServer,
  resetStandalonePage
} from "../helpers/standalone.ts";

describe("mountStandalone console", () => {
  afterEach(resetStandalonePage);

  test("hands the editor the console mounted on the page", async() => {
    const server = await openServer();

    const received: EditorContext["commands"][] = [];
    const editor = await mountStandalone(definition((context) => {
      received.push(context.commands);

      return Promise.resolve(editorHandle(context.session));
    }), offlineOptions(server));

    assert.equal(received.length, 1);
    const opened = new Promise<void>((resolve) => {
      received[0].subscribe("opened", () => resolve());
    });
    received[0].open();
    await opened;
    const elements = document.querySelectorAll("jolly-console");
    assert.equal(elements.length, 1);
    assert.equal(elements[0].console, received[0]);
    assert.notEqual(
      received[0].registry.resolveVariable("theme"),
      undefined
    );
    assert.notEqual(
      received[0].registry.resolveVariable("density"),
      undefined
    );

    editor.dispose();
    await server.close();
  });

  test("leaves the console to the shell that framed the page", async() => {
    const server = await openServer();
    const shell = new ShellChannel({
      port: { postMessage: () => undefined },
      origin: "http://studio.test"
    });

    const received: EditorContext["commands"][] = [];
    const editor = await mountStandalone(definition((context) => {
      received.push(context.commands);

      return Promise.resolve(editorHandle(context.session));
    }), {
      ...offlineOptions(server),
      sources: [
        {
          read: () => Promise.resolve(EditorLaunch.fromTarget(ASSET_ID, shell))
        }
      ]
    });

    assert.equal(document.querySelector("jolly-console"), null);
    assert.equal(received.length, 1);
    assert.equal(received[0].registry.resolveVariable("theme"), undefined);

    editor.dispose();
    await server.close();
  });

  test("removes the console when the boot fails", async() => {
    const server = await openServer();

    await assert.rejects(
      mountStandalone(definition(
        () => Promise.reject(new Error("mount failed"))
      ), offlineOptions(server)),
      /mount failed/
    );
    assert.equal(document.querySelector("jolly-console"), null);

    await server.close();
  });
});
