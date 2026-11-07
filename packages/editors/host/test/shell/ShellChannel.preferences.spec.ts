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

describe("ShellChannel preferences", () => {
  test("posts a preference change as a frame message", () => {
    const posted: unknown[] = [];
    const shell = shellChannel({
      port: {
        postMessage: (message) => posted.push(message)
      }
    });

    shell.updatePreferences("runtime", { stats: false });

    assert.deepEqual(posted, [{
      type: "jolly-update-preferences",
      scope: "runtime",
      patch: { stats: false }
    }]);
    assert.deepEqual(parseFrameMessage(posted[0]), posted[0]);
  });

  test("starts from the latest preferences, then follows those the shell pushes, and only the shell", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const shell = shellChannel({
      port: parent,
      preferences: {
        runtime: { stats: false },
        lantern: { seen: [] }
      }
    });
    const received: unknown[] = [];
    const listening = new AbortController();
    shell.onPreferences((scope, overrides) => {
      received.push([scope, overrides]);
    }, listening.signal);

    function post(
      source: MessageEventSource,
      data: unknown
    ): void {
      window.dispatchEvent(new MessageEvent("message", {
        source,
        origin: SHELL_ORIGIN,
        data
      }));
    }

    function preferences(
      overrides: Record<string, unknown>
    ): ShellMessage {
      return {
        type: "jolly-preferences",
        scope: "runtime",
        overrides
      };
    }

    post(window, preferences({ stats: "forged" }));
    post(parent, preferences({ stats: true }));
    post(parent, { type: "jolly-preferences", scope: "runtime" });
    listening.abort();
    post(parent, preferences({}));

    const late: unknown[] = [];
    shell.onPreferences((scope, overrides) => {
      late.push([scope, overrides]);
    }, new AbortController().signal);

    assert.deepEqual(received, [
      ["runtime", { stats: false }],
      ["lantern", { seen: [] }],
      ["runtime", { stats: true }]
    ]);
    assert.deepEqual(late, [
      ["runtime", {}],
      ["lantern", { seen: [] }]
    ]);
  });
});
