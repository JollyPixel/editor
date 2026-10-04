// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";
import {
  NormalMapConfig,
  PixelBuffer,
  PixelDocumentState,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyPixelCommand } from "#src/network/PixelCommandApplier.ts";
import { PixelCommandArbiter } from "#src/network/PixelCommandArbiter.ts";
import { pixelCommandProtocol } from "#src/network/PixelCommand.schema.ts";
import {
  encodePixelSnapshot,
  loadPixelSnapshot
} from "#src/network/PixelSnapshotCodec.ts";
import { command } from "../fixtures/commands.ts";

// CONSTANTS
const kEnabled = command("normal-map-toggled", {
  config: NormalMapConfig.create().toJSON()
});
const kZoneOff = {
  zone: { regionId: "a", settings: "off" },
  index: 0
} as const;

function accepts(
  payload: unknown
): boolean {
  return new MessageParser(pixelCommandProtocol).parse(payload).ok;
}

function enabledState(): PixelDocumentState {
  const state = new PixelDocumentState({
    buffer: new PixelBuffer({ size: { x: 4, y: 4 } })
  });
  applyPixelCommand(state, kEnabled);

  return state;
}

describe("normal map commands", () => {
  describe("applyPixelCommand", () => {
    test("toggles and patches the state config", () => {
      const state = enabledState();

      applyPixelCommand(state, command("normal-map-defaults-patched", {
        patch: { strength: 6 }
      }));
      applyPixelCommand(state, command("normal-map-zone-set", kZoneOff));

      assert.equal(state.normalMap?.defaults.strength, 6);
      assert.equal(state.normalMap?.zoneOf("a")?.settings, "off");

      applyPixelCommand(state, command("normal-map-zone-deleted", {
        regionId: "a"
      }));
      assert.deepEqual(state.normalMap?.zones, []);

      applyPixelCommand(state, command("normal-map-toggled", {
        config: null
      }));
      assert.equal(state.normalMap, null);
    });

    test("a region deletion drops its zone", () => {
      const state = enabledState();
      applyPixelCommand(state, command("normal-map-zone-set", kZoneOff));

      applyPixelCommand(state, command("uv-region-deleted", { id: "a" }));

      assert.deepEqual(state.normalMap?.zones, []);
    });
  });

  describe("protocol", () => {
    test("accepts every normal map command", () => {
      assert.equal(accepts(kEnabled), true);
      assert.equal(accepts(command("normal-map-defaults-patched", {
        patch: { strength: 4 }
      })), true);
      assert.equal(accepts(command("normal-map-zone-set", {
        zone: { regionId: "a", settings: { invert: true } },
        index: 0
      })), true);
      assert.equal(accepts(command("normal-map-zone-deleted", {
        regionId: "a"
      })), true);
    });

    test("rejects invalid settings", () => {
      assert.equal(accepts(command("normal-map-defaults-patched", {
        patch: { levels: 4 }
      })), false);
      assert.equal(accepts(command("normal-map-defaults-patched", {
        patch: { strength: -1 }
      })), false);
      assert.equal(accepts(command("normal-map-zone-set", {
        zone: { regionId: "", settings: "off" },
        index: 0
      })), false);
      assert.equal(accepts({
        ...command("normal-map-zone-set", kZoneOff),
        metadata: { zone: kZoneOff.zone }
      }), false);
    });
  });

  describe("PixelCommandArbiter", () => {
    test("drops an older patch of the same field", () => {
      const arbiter = new PixelCommandArbiter();
      const state = enabledState();
      const newer = arbiter.admit(state, command("normal-map-defaults-patched", {
        patch: { strength: 6 }
      }, { clientId: "B", timestamp: 900 }));
      newer?.commit();

      const older = arbiter.admit(state, command("normal-map-defaults-patched", {
        patch: { strength: 3 }
      }, { clientId: "A", timestamp: 500 }));
      const otherField = arbiter.admit(state, command("normal-map-defaults-patched", {
        patch: { invert: true }
      }, { clientId: "A", timestamp: 500 }));

      assert.equal(older, null);
      assert.notEqual(otherField, null);
    });

    test("a zone deletion conflicts with a newer set of the same zone", () => {
      const arbiter = new PixelCommandArbiter();
      const state = enabledState();
      arbiter.admit(state, command("normal-map-zone-set", kZoneOff, {
        clientId: "B",
        timestamp: 900
      }))?.commit();

      const older = arbiter.admit(state, command("normal-map-zone-deleted", {
        regionId: "a"
      }, { clientId: "A", timestamp: 500 }));

      assert.equal(older, null);
    });

    test("rejects a toggle carrying duplicate zones", () => {
      const arbiter = new PixelCommandArbiter();
      const config = NormalMapConfig.create().toJSON();
      config.zones = [
        { regionId: "a", settings: "off" },
        { regionId: "a", settings: "off" }
      ];

      assert.equal(
        arbiter.admit(enabledState(), command("normal-map-toggled", {
          config
        })),
        null
      );
    });
  });

  test("snapshots carry the config", async() => {
    const state = enabledState();
    applyPixelCommand(state, command("normal-map-zone-set", kZoneOff));
    const document = new PixelDocument({ size: { x: 1, y: 1 } });

    await loadPixelSnapshot(document, await encodePixelSnapshot(state));

    assert.deepEqual(document.normalMap?.toJSON(), state.normalMap?.toJSON());
  });
});
