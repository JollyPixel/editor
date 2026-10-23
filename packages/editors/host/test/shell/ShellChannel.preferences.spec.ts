// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isShellCommand,
  preferencesMessage,
  SHELL_MESSAGE_TYPE,
  ShellChannel
} from "#src/shell/ShellChannel.ts";

// CONSTANTS
const kShellOrigin = "http://studio.test";

describe("ShellChannel preferences", () => {
  test("posts a preference change as a shell command", () => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: {
        postMessage: (message) => posted.push(message)
      },
      origin: kShellOrigin
    });

    shell.updatePreferences("runtime", { stats: false });

    assert.deepEqual(posted, [{
      type: SHELL_MESSAGE_TYPE,
      command: "update-preferences",
      scope: "runtime",
      patch: { stats: false }
    }]);
    assert.equal(isShellCommand(posted[0]), true);
  });

  test("follows the preferences the shell pushes, and only the shell", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const shell = new ShellChannel({
      port: parent,
      origin: kShellOrigin
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
        origin: kShellOrigin,
        data
      }));
    }

    post(window, preferencesMessage("runtime", { stats: false }));
    post(parent, preferencesMessage("runtime", { stats: true }));
    post(parent, { type: "jolly-preferences", scope: "runtime" });
    listening.abort();
    post(parent, preferencesMessage("runtime", {}));

    assert.deepEqual(received, [["runtime", { stats: true }]]);
  });
});
