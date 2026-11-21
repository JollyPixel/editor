// Import Node.js Dependencies
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { KindPackageDescriptor } from "@jolly-pixel/server";

// Import Internal Dependencies
import { GolemKinds } from "#src/kinds/GolemKinds.ts";
import { UnsupportedKindError } from "#src/kinds/errors/UnsupportedKindError.ts";

// CONSTANTS
const kProjectRoot = path.join(import.meta.dirname, "..", "fixtures", "kinds");
const kLocalKind: KindPackageDescriptor = {
  name: "./localKind",
  kinds: ["local"],
  configurable: false,
  sceneComponents: []
};
const kBrokenKind: KindPackageDescriptor = {
  name: "./brokenKind",
  kinds: ["broken"],
  configurable: false,
  sceneComponents: []
};

describe("GolemKinds.load", () => {
  test("imports the golem entry of a kind package local to the project", async() => {
    const kinds = await GolemKinds.load([kLocalKind], kProjectRoot);

    assert.deepEqual(kinds.names(), ["local"]);
  });

  test("a package that fails to import leaves its kinds unsupported, with the failure as cause", async() => {
    const kinds = await GolemKinds.load([kBrokenKind, kLocalKind], kProjectRoot);

    assert.throws(() => kinds.contribution("broken"), (error: unknown) => {
      assert.ok(error instanceof UnsupportedKindError);
      assert.match(String(error.cause), /broken kind package/);

      return true;
    });
    assert.ok(kinds.has("local"));
  });
});
