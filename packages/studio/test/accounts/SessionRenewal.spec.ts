// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  SessionRenewal,
  type SessionRenewalOptions
} from "../../src/accounts/SessionRenewal.ts";

// CONSTANTS
const kAlice: Account = {
  id: "alice-id",
  username: "alice",
  role: "default",
  owner: false
};
const kBob: Account = {
  ...kAlice,
  id: "bob-id",
  username: "bob"
};

class RenewalProbe {
  reloads = 0;
  renewed = 0;
  readonly renewal: SessionRenewal;

  constructor(
    options: Partial<SessionRenewalOptions>
  ) {
    this.renewal = new SessionRenewal({
      accountId: kAlice.id,
      currentAccount: async() => null,
      signIn: async() => kAlice,
      reload: () => {
        this.reloads++;
      },
      ...options
    });
    this.renewal.onRenewed(() => {
      this.renewed++;
    });
  }
}

describe("SessionRenewal", () => {
  test("renews without asking to sign in when the session is valid again", async() => {
    const probe = new RenewalProbe({
      currentAccount: async() => kAlice,
      signIn: () => assert.fail("asked to sign in")
    });

    await probe.renewal.renew();

    assert.equal(probe.renewed, 1);
    assert.equal(probe.reloads, 0);
  });

  test("asks to sign in once for refusals that arrive while it is renewing", async() => {
    const signedIn = Promise.withResolvers<Account>();
    let signIns = 0;
    const probe = new RenewalProbe({
      signIn: () => {
        signIns++;

        return signedIn.promise;
      }
    });

    const first = probe.renewal.renew();
    const second = probe.renewal.renew();
    signedIn.resolve(kAlice);
    await Promise.all([first, second]);
    await probe.renewal.renew();

    assert.equal(signIns, 2);
    assert.equal(probe.renewed, 2);
  });

  test("reloads when another account signs in or the account check fails", async() => {
    const other = new RenewalProbe({
      signIn: async() => kBob
    });
    const offline = new RenewalProbe({
      currentAccount: () => Promise.reject(new Error("offline"))
    });

    await other.renewal.renew();
    await offline.renewal.renew();

    assert.deepEqual(
      [other.reloads, other.renewed, offline.reloads, offline.renewed],
      [1, 0, 1, 0]
    );
  });
});
