// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PasswordAuthentication } from "#src/server/auth/providers/PasswordAuthentication.ts";
import type { AuthenticationRequest } from "#src/server/auth/AuthenticationProvider.ts";

function request(
  credential?: string
): AuthenticationRequest {
  return {
    clientId: "client-1",
    url: "/ws-sync",
    defaultRole: "viewer",
    headers: {},
    credential
  };
}

describe("PasswordAuthentication — optional password", () => {
  const auth = new PasswordAuthentication({
    password: "hunter2",
    role: "editor"
  });

  test("grants the configured role for a correct password", async() => {
    assert.deepEqual(await auth.authenticate(request("hunter2")), {
      subject: "client-1",
      role: "editor"
    });
  });

  test("falls through to the server default role when no credential is offered", async() => {
    assert.deepEqual(await auth.authenticate(request()), {
      subject: "client-1",
      role: "viewer"
    });
  });

  test("rejects a wrong password rather than falling through", async() => {
    assert.strictEqual(await auth.authenticate(request("wrong")), null);
  });

  test("rejects a password differing only in length", async() => {
    assert.strictEqual(await auth.authenticate(request("hunter22")), null);
    assert.strictEqual(await auth.authenticate(request("hunter")), null);
  });
});

describe("PasswordAuthentication — mandatory password", () => {
  const auth = new PasswordAuthentication({
    password: "hunter2",
    role: "editor",
    mandatory: true
  });

  test("rejects a client offering no credential", async() => {
    assert.strictEqual(await auth.authenticate(request()), null);
  });

  test("still grants the role for a correct password", async() => {
    assert.deepEqual(await auth.authenticate(request("hunter2")), {
      subject: "client-1",
      role: "editor"
    });
  });
});

describe("PasswordAuthentication — non-ascii password", () => {
  const auth = new PasswordAuthentication({
    password: "pässwörd ✅",
    role: "editor"
  });

  test("grants the role for the same non-ascii password", async() => {
    assert.deepEqual(await auth.authenticate(request("pässwörd ✅")), {
      subject: "client-1",
      role: "editor"
    });
  });
});

describe("PasswordAuthentication — attempt limits", () => {
  function from(
    remoteAddress: string,
    credential: string
  ): AuthenticationRequest {
    return {
      ...request(credential),
      remoteAddress
    };
  }

  test("refuses an address past maxFailures, even with the right password", async() => {
    const auth = new PasswordAuthentication({
      password: "hunter2",
      role: "editor",
      maxFailures: 2
    });

    await auth.authenticate(from("10.0.0.1", "wrong"));
    await auth.authenticate(from("10.0.0.1", "wrong"));

    assert.strictEqual(await auth.authenticate(from("10.0.0.1", "hunter2")), null);
    assert.deepEqual(await auth.authenticate(from("10.0.0.2", "hunter2")), {
      subject: "client-1",
      role: "editor"
    });
  });

  test("a correct password clears the address's failures", async() => {
    const auth = new PasswordAuthentication({
      password: "hunter2",
      role: "editor",
      maxFailures: 2
    });

    await auth.authenticate(from("10.0.0.1", "wrong"));
    await auth.authenticate(from("10.0.0.1", "hunter2"));
    await auth.authenticate(from("10.0.0.1", "wrong"));

    assert.notStrictEqual(await auth.authenticate(from("10.0.0.1", "hunter2")), null);
  });

  test("queues attempts past maxConcurrentChecks instead of refusing them", async() => {
    const auth = new PasswordAuthentication({
      password: "hunter2",
      role: "editor",
      maxConcurrentChecks: 1
    });

    const identities = await Promise.all([
      auth.authenticate(from("10.0.0.1", "hunter2")),
      auth.authenticate(from("10.0.0.2", "hunter2")),
      auth.authenticate(from("10.0.0.3", "hunter2"))
    ]);

    assert.ok(identities.every((identity) => identity !== null));
  });

  test("counts parallel guesses before checking them, so the ones past maxFailures are refused", async() => {
    const auth = new PasswordAuthentication({
      password: "hunter2",
      role: "editor",
      maxFailures: 2
    });

    const results = await Promise.all(
      ["wrong", "wrong", "wrong", "hunter2"].map(
        (credential) => auth.authenticate(from("10.0.0.1", credential))
      )
    );

    assert.ok(results.every((identity) => identity === null));
  });

  test("admits as many parallel right-password attempts from one address as maxFailures", async() => {
    const auth = new PasswordAuthentication({
      password: "hunter2",
      role: "editor",
      maxFailures: 4
    });

    const identities = await Promise.all(
      Array.from({ length: 4 }, () => auth.authenticate(from("10.0.0.1", "hunter2")))
    );

    assert.ok(identities.every((identity) => identity !== null));
  });
});
