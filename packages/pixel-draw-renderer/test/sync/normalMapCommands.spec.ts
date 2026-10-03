// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyNormalMapCommand,
  isNormalMapCommand
} from "#src/sync/normalMapCommands.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";

describe("isNormalMapCommand", () => {
  test("matches only the normal map actions", () => {
    assert.equal(isNormalMapCommand({ action: "normal-map-zone-set" }), true);
    assert.equal(isNormalMapCommand({ action: "normal-map-other" }), false);
    assert.equal(isNormalMapCommand({ action: "uv-region-deleted" }), false);
  });
});

describe("applyNormalMapCommand", () => {
  test("applies every normal map command", () => {
    const data = NormalMapConfig.create()
      .withZone({ regionId: "brick", settings: { strength: 4 } })
      .withZone({ regionId: "glass", settings: "off" })
      .toJSON();

    let config = applyNormalMapCommand(null, {
      action: "normal-map-toggled",
      metadata: { config: data }
    });
    config = applyNormalMapCommand(config, {
      action: "normal-map-defaults-patched",
      metadata: { patch: { strength: 5 } }
    });
    config = applyNormalMapCommand(config, {
      action: "normal-map-zone-set",
      metadata: { zone: { regionId: "moss", settings: "off" }, index: 1 }
    });
    config = applyNormalMapCommand(config, {
      action: "normal-map-zone-deleted",
      metadata: { regionId: "glass" }
    });

    assert.equal(config?.defaults.strength, 5);
    assert.deepEqual(
      config?.zones.map((zone) => zone.regionId),
      ["brick", "moss"]
    );
  });

  test("ignores patches while the feature is off", () => {
    assert.equal(
      applyNormalMapCommand(null, {
        action: "normal-map-defaults-patched",
        metadata: { patch: { strength: 5 } }
      }),
      null
    );
  });
});
