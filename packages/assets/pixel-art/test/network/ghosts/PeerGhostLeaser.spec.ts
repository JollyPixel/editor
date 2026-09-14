// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerGhostLeaser } from "#src/network/ghosts/PeerGhostLeaser.ts";

describe("PeerGhostLeaser", () => {
  test("expires a lease after the default 1500ms", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const expired: string[] = [];
    const leaser = new PeerGhostLeaser({
      onExpire(clientId) {
        expired.push(clientId);
      }
    });

    leaser.renew("peer-A");
    t.mock.timers.tick(1499);
    assert.deepStrictEqual(expired, []);

    t.mock.timers.tick(1);
    assert.deepStrictEqual(expired, ["peer-A"]);
  });

  test("uses the timeout supplied through options", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const expired: string[] = [];
    const leaser = new PeerGhostLeaser({
      onExpire(clientId) {
        expired.push(clientId);
      },
      timeoutMs: 25
    });

    leaser.renew("peer-A");
    t.mock.timers.tick(24);
    assert.deepStrictEqual(expired, []);

    t.mock.timers.tick(1);
    assert.deepStrictEqual(expired, ["peer-A"]);
  });

  test("renew restarts only the selected peer's lease", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const expired: string[] = [];
    const leaser = new PeerGhostLeaser({
      onExpire(clientId) {
        expired.push(clientId);
      },
      timeoutMs: 10
    });

    leaser.renew("peer-A");
    leaser.renew("peer-B");
    t.mock.timers.tick(6);
    leaser.renew("peer-A");
    t.mock.timers.tick(4);
    assert.deepStrictEqual(expired, ["peer-B"]);

    t.mock.timers.tick(6);
    assert.deepStrictEqual(expired, ["peer-B", "peer-A"]);
  });

  test("cancel and clear prevent expiration callbacks", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });

    const expired: string[] = [];
    const leaser = new PeerGhostLeaser({
      onExpire(clientId) {
        expired.push(clientId);
      },
      timeoutMs: 10
    });

    leaser.renew("peer-A");
    leaser.cancel("peer-A");
    leaser.renew("peer-B");
    leaser.renew("peer-C");
    leaser.clear();
    t.mock.timers.tick(10);

    assert.deepStrictEqual(expired, []);
  });
});
