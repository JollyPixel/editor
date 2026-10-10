// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  WRONG_PASSWORD,
  createDatabase,
  createDirectory,
  databaseWith,
  name,
  registration
} from "./helpers/accounts.ts";
import { InvalidCredentialsError } from "#src/auth/errors/InvalidCredentialsError.ts";
import { AccountsThrottledError } from "#src/node.ts";

describe("AccountDirectory throttle", () => {
  test("counts parallel logins before checking any password", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database, {
      throttle: {
        attempts: 3
      }
    });

    const outcomes = await Promise.allSettled(
      Array.from({ length: 12 }, () => directory.login({
        username: name("Alice"),
        password: WRONG_PASSWORD
      }, ADDRESS))
    );
    const reasons = outcomes.map((outcome) => (outcome.status === "rejected" ? outcome.reason : null));

    assert.equal(reasons.filter((reason) => reason instanceof InvalidCredentialsError).length, 3);
    assert.equal(reasons.filter((reason) => reason instanceof AccountsThrottledError).length, 9);
  });

  test("throttles registrations from one address", async() => {
    using database = createDatabase();
    const directory = createDirectory(database, {
      throttle: {
        registrations: 2
      }
    });

    await directory.register(registration("Alice"), ADDRESS);
    await directory.register(registration("Bob"), ADDRESS);
    await assert.rejects(
      directory.register(registration("Carol"), ADDRESS),
      AccountsThrottledError
    );
    await directory.register(registration("Carol"), "198.51.100.1");
    assert.equal(database.accounts.size, 3);
  });
});
