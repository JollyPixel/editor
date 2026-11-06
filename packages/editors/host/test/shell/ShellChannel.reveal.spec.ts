// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  parseFrameMessage,
  type ShellMessage
} from "#src/shell/protocol.ts";
import {
  SHELL_ORIGIN,
  shellChannel
} from "../helpers/shell.ts";

describe("ShellChannel reveals", () => {
  test("asks the shell to open an asset at a reveal", () => {
    const posted: unknown[] = [];
    const shell = shellChannel({
      port: { postMessage: (message) => posted.push(message) }
    });

    shell.openAsset("map-1", "object:spawn");

    assert.deepEqual(posted, [{
      type: "jolly-open-asset",
      target: "map-1",
      reveal: "object:spawn"
    }]);
    assert.deepEqual(parseFrameMessage(posted[0]), posted[0]);
  });

  test("keeps the last reveal until a listener takes it, then hands over the shell's later ones", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const shell = shellChannel({
      port: parent
    });
    const received: string[] = [];

    function post(
      source: MessageEventSource,
      key: string
    ): void {
      window.dispatchEvent(new MessageEvent("message", {
        source,
        origin: SHELL_ORIGIN,
        data: { type: "jolly-reveal", key } satisfies ShellMessage
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
