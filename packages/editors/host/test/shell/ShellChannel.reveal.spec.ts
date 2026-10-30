// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isShellCommand,
  revealMessage,
  SHELL_MESSAGE_TYPE,
  ShellChannel
} from "#src/shell/ShellChannel.ts";

// CONSTANTS
const kShellOrigin = "http://studio.test";

describe("ShellChannel reveals", () => {
  test("asks the shell to open an asset at a reveal", () => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: kShellOrigin
    });

    shell.openAsset("map-1", "object:spawn");

    assert.deepEqual(posted, [{
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "map-1",
      reveal: "object:spawn"
    }]);
    assert.equal(isShellCommand(posted[0]), true);
  });

  test("keeps the last reveal until a listener takes it, then hands over the shell's later ones", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const shell = new ShellChannel({
      port: parent,
      origin: kShellOrigin
    });
    const received: string[] = [];

    function post(
      source: MessageEventSource,
      key: string
    ): void {
      window.dispatchEvent(new MessageEvent("message", {
        source,
        origin: kShellOrigin,
        data: revealMessage(key)
      }));
    }

    post(parent, "object:early");
    post(window, "object:forged");
    const listening = new AbortController();
    shell.onReveal((key) => received.push(key), listening.signal);
    post(parent, "object:later");
    listening.abort();
    post(parent, "object:unread");

    assert.deepEqual(received, ["object:early", "object:later"]);

    shell.onReveal((key) => received.push(key), new AbortController().signal);
    assert.deepEqual(received, ["object:early", "object:later", "object:unread"]);
  });
});
