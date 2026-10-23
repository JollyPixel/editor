// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import { peerConsole } from "#src/console/namespaces/peer.ts";
import { PeerInvite } from "#src/offline/peer/PeerInvite.ts";
import type { PeerSharing } from "#src/connection/OfflineMode.ts";

describe("peer console", () => {
  test("invite prints a link that opens a guest on this page", async() => {
    const commands = new CommandConsole();
    const invite = new PeerInvite("host-id", "token");
    const peers: PeerSharing = {
      guests: 0,
      invite: () => invite,
      stop: () => undefined
    };
    peerConsole(commands, { peers });

    await commands.submit("/peer.invite");
    const link = new URL(commands.scrollback.at(-1)?.text ?? "");

    assert.equal(link.origin + link.pathname, location.origin + location.pathname);
    assert.deepEqual(PeerInvite.fromHash(link.hash), invite);
  });

  test("offers no peer commands when offline mode cannot share", async() => {
    const commands = new CommandConsole();
    peerConsole(commands, {});

    await commands.submit("/peer.invite");

    assert.match(
      commands.scrollback.at(-1)?.text ?? "",
      /Unknown command "\/peer\.invite"/
    );
  });
});
