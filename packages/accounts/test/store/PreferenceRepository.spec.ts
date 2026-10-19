// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { databaseWith } from "../helpers/accounts.ts";

describe("PreferenceRepository", () => {
  test("keeps one overrides object per account and scope", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;

    database.preferences.replace(alice.id, "studio", { theme: "dark" });
    database.preferences.replace(alice.id, "studio", { density: "compact" });
    database.preferences.replace(alice.id, "camera", { invertY: true });
    database.preferences.replace(bob.id, "studio", { theme: "light" });

    assert.deepEqual(database.preferences.findAll(alice.id), new Map([
      ["camera", { invertY: true }],
      ["studio", { density: "compact" }]
    ]));
  });

  test("forgets a scope replaced with no overrides", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;

    database.preferences.replace(alice.id, "studio", { theme: "dark" });
    database.preferences.replace(alice.id, "studio", {});

    assert.equal(database.preferences.findAll(alice.id).size, 0);
  });

  test("drops the preferences of a deleted account", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;

    database.preferences.replace(bob.id, "studio", { theme: "dark" });
    database.accounts.delete(bob.id);

    assert.equal(database.preferences.findAll(bob.id).size, 0);
  });
});
