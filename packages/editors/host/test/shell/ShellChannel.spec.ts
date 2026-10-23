// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { ClientEventMap } from "@jolly-pixel/network/client";
import { peerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  APPEARANCE_MESSAGE_TYPE,
  isReadyMessage,
  isShellCommand,
  LAUNCH_MESSAGE_TYPE,
  launchMessage,
  parseLaunchMessage,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  sessionRenewedMessage,
  ShellChannel,
  type LaunchIdentity
} from "#src/shell/ShellChannel.ts";

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
      { type: SHELL_MESSAGE_TYPE, command: "editor-state", state: "loading" },
      { type: READY_MESSAGE_TYPE, command: "toggle-console" }
    ]) {
      assert.equal(isShellCommand(data), false);
    }
  });

  test("accepts the commands without a target", () => {
    for (const command of ["toggle-console", "session-refused"]) {
      assert.equal(isShellCommand({
        type: SHELL_MESSAGE_TYPE,
        command
      }), true);
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

  test("parses a launch and drops invalid appearance, preferences or ports", () => {
    assert.deepEqual(parseLaunchMessage({
      type: LAUNCH_MESSAGE_TYPE,
      target: "x",
      appearance: { theme: "pink", density: "compact" },
      preferences: { runtime: "stats" },
      ports: { catalog: "not a port" }
    }), {
      type: LAUNCH_MESSAGE_TYPE,
      target: "x",
      appearance: undefined,
      identity: null,
      preferences: {},
      ports: {}
    });
    assert.equal(parseLaunchMessage({ type: LAUNCH_MESSAGE_TYPE }), undefined);
    assert.equal(parseLaunchMessage({ target: "x" }), undefined);
  });

  test("parses a launch identity and nulls a blank or partial one", () => {
    function createIdentity(identity: unknown) {
      return parseLaunchMessage({
        type: LAUNCH_MESSAGE_TYPE,
        target: "x",
        identity
      })?.identity;
    }

    assert.deepEqual(createIdentity({ username: " alice ", peerId: "p-1" }), {
      username: "alice",
      peerId: "p-1"
    });
    assert.deepEqual(createIdentity({ username: "alice", peerId: "p-1", avatar: "/a.webp" }), {
      username: "alice",
      peerId: "p-1",
      avatar: "/a.webp"
    });
    assert.equal(
      createIdentity({ username: "alice", peerId: "p-1", avatar: 42 })?.avatar,
      undefined
    );
    assert.equal(createIdentity({ username: "  ", peerId: "p-1" }), null);
    assert.equal(createIdentity({ username: "alice" }), null);
    assert.equal(createIdentity("alice"), null);
    assert.equal(createIdentity(undefined), null);
  });
});

describe("launchMessage", () => {
  test("reaches the frame with only the username and peer id of a peer", () => {
    const appearance = { theme: "dark", density: "default" } as const;
    const preferences = { runtime: { stats: false } };
    const message = launchMessage({
      target: "x",
      appearance,
      identity: peerIdentity("alice", "p-1"),
      preferences
    });

    assert.deepEqual(parseLaunchMessage(message), {
      type: LAUNCH_MESSAGE_TYPE,
      target: "x",
      appearance,
      identity: {
        username: "alice",
        peerId: "p-1"
      },
      preferences,
      ports: {}
    });
  });
});

describe("ShellChannel.identity", () => {
  test("is the launch identity with a color derived from its peer id", () => {
    function channel(identity?: LaunchIdentity) {
      return new ShellChannel({
        port: { postMessage: () => undefined },
        origin: kShellOrigin,
        identity
      });
    }

    assert.deepEqual(
      channel({ username: "alice", peerId: "p-1" }).identity,
      peerIdentity("alice", "p-1")
    );
    assert.equal(channel().identity, null);
  });

  test("keeps the avatar of the launch identity", () => {
    const shell = new ShellChannel({
      port: { postMessage: () => undefined },
      origin: kShellOrigin,
      identity: {
        username: "alice",
        peerId: "p-1",
        avatar: "/api/accounts/p-1/avatar?v=1"
      }
    });

    assert.deepEqual(shell.identity, {
      ...peerIdentity("alice", "p-1"),
      avatar: "/api/accounts/p-1/avatar?v=1"
    });
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

describe("ShellChannel.renewWhenRefused", () => {
  class RefusableClient extends Emitter<ClientEventMap> {
    reconnects = 0;

    reconnect(): void {
      this.reconnects++;
    }
  }

  test("reports a refusal to the shell and reconnects once the shell renews the session", () => {
    const posted: unknown[] = [];
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: (message: unknown) => {
        posted.push(message);
      }
    });
    const shell = new ShellChannel({
      port: parent,
      origin: kShellOrigin
    });
    const client = new RefusableClient();
    shell.renewWhenRefused(client);

    function renew(
      source: MessageEventSource,
      origin: string
    ): void {
      window.dispatchEvent(new MessageEvent("message", {
        source,
        origin,
        data: sessionRenewedMessage()
      }));
    }

    renew(parent, kShellOrigin);
    client.emit("unauthorized");
    renew(window, kShellOrigin);
    renew(parent, "http://elsewhere.test");
    assert.equal(client.reconnects, 0);

    renew(parent, kShellOrigin);
    renew(parent, kShellOrigin);

    assert.equal(client.reconnects, 1);
    assert.deepEqual(posted, [
      {
        type: SHELL_MESSAGE_TYPE,
        command: "session-refused"
      }
    ]);
  });
});
