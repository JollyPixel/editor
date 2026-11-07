// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { peerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  parseFrameMessage,
  parseLaunchMessage,
  parseShellMessage
} from "#src/shell/protocol.ts";

describe("parseFrameMessage", () => {
  test("accepts an open-asset command with a string target", () => {
    assert.notEqual(parseFrameMessage({
      type: "jolly-open-asset",
      target: "asset-1"
    }), undefined);
    assert.deepEqual(parseFrameMessage({
      type: "jolly-open-asset",
      target: "",
      extra: true
    }), {
      type: "jolly-open-asset",
      target: ""
    });
  });

  test("rejects malformed frame messages", () => {
    for (const data of [
      null,
      [],
      { type: "jolly-close", target: "a" },
      { type: "jolly-open-asset", target: 1 },
      { type: "jolly-open-asset" },
      { type: "jolly-editor-state", state: "loading" },
      { type: "jolly-launch", target: "a" },
      { type: "jolly-notification", id: "n-1", notification: { tone: "fatal", title: "Boom" } }
    ]) {
      assert.equal(parseFrameMessage(data), undefined);
    }
  });

  test("accepts the messages that carry no fields", () => {
    for (const type of ["jolly-ready", "jolly-toggle-console", "jolly-session-refused"]) {
      assert.deepEqual(parseFrameMessage({ type, extra: true }), { type });
    }
  });
});

describe("parseLaunchMessage", () => {
  test("parses a launch and drops invalid reveal, appearance, preferences or ports", () => {
    assert.deepEqual(parseLaunchMessage({
      type: "jolly-launch",
      target: "x",
      reveal: 42,
      appearance: { theme: "pink", density: "compact" },
      preferences: { runtime: "stats" },
      ports: { catalog: "not a port" }
    }), {
      type: "jolly-launch",
      target: "x",
      reveal: undefined,
      appearance: undefined,
      identity: null,
      preferences: {},
      ports: {}
    });
    assert.equal(parseLaunchMessage({ type: "jolly-launch" }), undefined);
    assert.equal(parseLaunchMessage({ target: "x" }), undefined);
    assert.equal(parseLaunchMessage({ type: "jolly-reveal", key: "k" }), undefined);
    assert.equal(parseShellMessage({ type: "jolly-launch", target: "x" }), undefined);
  });

  test("parses a launch identity and nulls a blank or partial one", () => {
    function launchIdentity(identity: unknown) {
      return parseLaunchMessage({
        type: "jolly-launch",
        target: "x",
        identity
      })?.identity;
    }

    assert.deepEqual(launchIdentity({ username: " alice ", peerId: "p-1" }), {
      username: "alice",
      peerId: "p-1"
    });
    assert.deepEqual(launchIdentity({ username: "alice", peerId: "p-1", avatar: "/a.webp" }), {
      username: "alice",
      peerId: "p-1",
      avatar: "/a.webp"
    });
    assert.equal(
      launchIdentity({ username: "alice", peerId: "p-1", avatar: 42 })?.avatar,
      undefined
    );
    assert.equal(launchIdentity({ username: "  ", peerId: "p-1" }), null);
    assert.equal(launchIdentity({ username: "alice" }), null);
    assert.equal(launchIdentity("alice"), null);
    assert.equal(launchIdentity(undefined), null);
  });

  test("keeps only the username and peer id of a launched peer", () => {
    assert.deepEqual(
      parseLaunchMessage({
        type: "jolly-launch",
        target: "x",
        identity: peerIdentity("alice", "p-1")
      })?.identity,
      {
        username: "alice",
        peerId: "p-1"
      }
    );
  });
});
