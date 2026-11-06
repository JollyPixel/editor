// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { ClientEventMap } from "@jolly-pixel/network/client";
import { peerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ShellMessage } from "#src/shell/protocol.ts";
import {
  SHELL_ORIGIN,
  shellChannel
} from "../helpers/shell.ts";

describe("ShellChannel.identity", () => {
  test("is the launch identity with a color derived from its peer id", () => {
    assert.deepEqual(
      shellChannel({ identity: { username: "alice", peerId: "p-1" } }).identity,
      peerIdentity("alice", "p-1")
    );
    assert.equal(shellChannel().identity, null);
  });

  test("keeps the avatar of the launch identity", () => {
    const shell = shellChannel({
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
  test("starts from the latest appearance, then follows valid ones from the shell only", () => {
    const parent = Object.assign(new MessageChannel().port1, {
      postMessage: () => undefined
    });
    const dark = { theme: "dark", density: "default" } as const;
    const shell = shellChannel({
      port: parent,
      appearance: dark
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
          type: "jolly-appearance",
          appearance
        }
      }));
    }

    const light = { theme: "light", density: "default" };
    post(window, SHELL_ORIGIN, light);
    post(parent, "http://elsewhere.test", light);
    post(parent, SHELL_ORIGIN, { theme: "pink", density: "default" });
    post(parent, SHELL_ORIGIN, light);
    listening.abort();
    post(parent, SHELL_ORIGIN, light);

    const late: unknown[] = [];
    shell.onAppearance((appearance) => {
      late.push(appearance);
    }, new AbortController().signal);

    assert.deepEqual(received, [dark, light]);
    assert.deepEqual(late, [light]);
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
    const shell = shellChannel({
      port: parent
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
        data: { type: "jolly-session-renewed" } satisfies ShellMessage
      }));
    }

    renew(parent, SHELL_ORIGIN);
    client.emit("unauthorized");
    renew(window, SHELL_ORIGIN);
    renew(parent, "http://elsewhere.test");
    assert.equal(client.reconnects, 0);

    renew(parent, SHELL_ORIGIN);
    renew(parent, SHELL_ORIGIN);

    assert.equal(client.reconnects, 1);
    assert.deepEqual(posted, [
      {
        type: "jolly-session-refused"
      }
    ]);
  });
});
