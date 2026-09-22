// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isReadyMessage,
  isShellCommand,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE
} from "#src/launch/ShellChannel.ts";

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
      { type: SHELL_MESSAGE_TYPE, command: "open-asset", target: 1 }
    ]) {
      assert.equal(isShellCommand(data), false);
    }
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
});
