// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  APPEARANCE_MESSAGE_TYPE,
  isReadyMessage,
  isShellCommand,
  LAUNCH_MESSAGE_TYPE,
  parseLaunchMessage,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  ShellChannel
} from "#src/launch/ShellChannel.ts";

// CONSTANTS
const kShellOrigin = "http://studio.test";

describe("ShellChannel message guards", () => {
  test("accepts shell commands with a string target", () => {
    assert.equal(isShellCommand({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "asset-1"
    }), true);
    assert.equal(isShellCommand({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "",
      extra: true
    }), true);
  });

  test("rejects malformed shell commands", () => {
    for (const data of [
      null,
      [],
      { type: READY_MESSAGE_TYPE },
      { type: SHELL_MESSAGE_TYPE, command: "close", target: "a" },
      { type: SHELL_MESSAGE_TYPE, command: "open-asset", target: 1 },
      { type: SHELL_MESSAGE_TYPE, command: "open-asset" },
      { type: READY_MESSAGE_TYPE, command: "toggle-console" }
    ]) {
      assert.equal(isShellCommand(data), false);
    }
  });

  test("accepts the toggle-console command without a target", () => {
    assert.equal(isShellCommand({
      type: SHELL_MESSAGE_TYPE,
      command: "toggle-console"
    }), true);
  });

  test("accepts only ready messages", () => {
    assert.equal(isReadyMessage({ type: READY_MESSAGE_TYPE }), true);
    assert.equal(isReadyMessage({
      type: READY_MESSAGE_TYPE,
      extra: true
    }), true);
    assert.equal(isReadyMessage({ type: SHELL_MESSAGE_TYPE }), false);
    assert.equal(isReadyMessage(null), false);
  });

  test("parses a launch and drops an invalid appearance or ports", () => {
    assert.deepEqual(parseLaunchMessage({
      type: LAUNCH_MESSAGE_TYPE,
      target: "x",
      appearance: { theme: "pink", density: "compact" },
      ports: { catalog: "not a port" }
    }), {
      type: LAUNCH_MESSAGE_TYPE,
      target: "x",
      appearance: undefined,
      ports: {}
    });
    assert.equal(parseLaunchMessage({ type: LAUNCH_MESSAGE_TYPE }), undefined);
    assert.equal(parseLaunchMessage({ target: "x" }), undefined);
  });
});

describe("ShellChannel.onAppearance", () => {
  test("follows valid appearance messages from the shell only", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const shell = new ShellChannel({
      port: parent,
      origin: kShellOrigin
    });
    const received: unknown[] = [];
    const listening = new AbortController();
    shell.onAppearance((appearance) => {
      received.push(appearance);
    }, listening.signal);

    function post(
      source: MessageEventSource,
      origin: string,
      appearance: unknown
    ): void {
      window.dispatchEvent(new MessageEvent("message", {
        source,
        origin,
        data: {
          type: APPEARANCE_MESSAGE_TYPE,
          appearance
        }
      }));
    }

    const light = { theme: "light", density: "default" };
    post(window, kShellOrigin, light);
    post(parent, "http://elsewhere.test", light);
    post(parent, kShellOrigin, { theme: "pink", density: "default" });
    post(parent, kShellOrigin, light);
    listening.abort();
    post(parent, kShellOrigin, light);

    assert.deepEqual(received, [light]);
  });
});
