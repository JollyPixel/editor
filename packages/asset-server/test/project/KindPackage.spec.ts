// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { KindPackage } from "#src/node.ts";
import {
  kindDescriptor,
  kindPackage,
  packageLoader
} from "../helpers/kindPackages.ts";

describe("KindPackage", () => {
  test("builds the handlers of ASSET_KINDS with its options", async() => {
    const received: object[] = [];
    const loaded = await KindPackage.load(
      "kind-a",
      { size: 8 },
      packageLoader({
        "kind-a": {
          ASSET_KINDS: kindPackage(["alpha", "beta"], received)
        }
      })
    );

    assert.strictEqual(loaded.name, "kind-a");
    assert.deepEqual(loaded.options, { size: 8 });
    assert.deepEqual(received, [{ size: 8 }]);
    assert.deepEqual(
      loaded.handlers.map((handler) => handler.kind),
      ["alpha", "beta"]
    );
    assert.deepEqual(
      loaded.descriptors,
      [kindDescriptor("alpha"), kindDescriptor("beta")]
    );
  });

  test("names a package that cannot be loaded", async() => {
    await assert.rejects(
      KindPackage.load("missing-kind", {}, packageLoader({})),
      {
        name: "TypeError",
        message: "Cannot load the kind package \"missing-kind\"."
      }
    );
  });

  test("names a package without an ASSET_KINDS export", async() => {
    const exports = [
      null,
      {
        kinds: kindPackage(["alpha"])
      },
      {
        ASSET_KINDS: {
          descriptors: []
        }
      },
      {
        ASSET_KINDS: {
          ...kindPackage(["alpha"]),
          optionsSchema: undefined
        }
      }
    ];

    for (const value of exports) {
      await assert.rejects(
        KindPackage.load("kind-a", {}, packageLoader({ "kind-a": value })),
        {
          name: "TypeError",
          message: "\"kind-a\" does not export \"ASSET_KINDS\"."
        }
      );
    }
  });

  test("names a package exporting invalid descriptors", async() => {
    await assert.rejects(
      KindPackage.load("kind-a", {}, packageLoader({
        "kind-a": {
          ASSET_KINDS: {
            ...kindPackage(["alpha"]),
            descriptors: [{ kind: "alpha" }]
          }
        }
      })),
      {
        name: "TypeError",
        message: "\"kind-a\" exports invalid \"ASSET_KINDS\" descriptors."
      }
    );
  });

  test("rejects a descriptor whose kind it does not handle", async() => {
    await assert.rejects(
      KindPackage.load("kind-a", {}, packageLoader({
        "kind-a": {
          ASSET_KINDS: {
            ...kindPackage(["alpha"]),
            descriptors: [kindDescriptor("beta")]
          }
        }
      })),
      {
        name: "TypeError",
        message: "\"kind-a\" describes the asset kind \"beta\" without handling it."
      }
    );
  });

  test("names a package receiving options its schema rejects", async() => {
    const received: object[] = [];

    await assert.rejects(
      KindPackage.load("kind-a", { size: "8" }, packageLoader({
        "kind-a": {
          ASSET_KINDS: {
            ...kindPackage(["alpha"], received),
            optionsSchema: {
              type: "object",
              properties: {
                size: { type: "number" }
              }
            }
          }
        }
      })),
      (error) => error instanceof TypeError &&
        error.message.startsWith("\"kind-a\" received invalid options:") &&
        error.message.includes("/size")
    );
    assert.deepEqual(received, []);
  });
});
