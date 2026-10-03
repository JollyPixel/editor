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
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyCommandToBuffer } from "#src/network/PixelCommandApplier.ts";
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

function enabledBuffer(): PixelBuffer {
  const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });
  applyCommandToBuffer(buffer, kEnabled);

  return buffer;
}

describe("normal map commands", () => {
  describe("applyCommandToBuffer", () => {
    test("toggles and patches the buffer config", () => {
      const buffer = enabledBuffer();

      applyCommandToBuffer(buffer, command("normal-map-defaults-patched", {
        patch: { strength: 6 }
      }));
      applyCommandToBuffer(buffer, command("normal-map-zone-set", kZoneOff));

      assert.equal(buffer.normalMap?.defaults.strength, 6);
      assert.equal(buffer.normalMap?.zoneOf("a")?.settings, "off");

      applyCommandToBuffer(buffer, command("normal-map-zone-deleted", {
        regionId: "a"
      }));
      assert.deepEqual(buffer.normalMap?.zones, []);

      applyCommandToBuffer(buffer, command("normal-map-toggled", {
        config: null
      }));
      assert.equal(buffer.normalMap, null);
    });

    test("a region deletion drops its zone", () => {
      const buffer = enabledBuffer();
      applyCommandToBuffer(buffer, command("normal-map-zone-set", kZoneOff));

      applyCommandToBuffer(buffer, command("uv-region-deleted", { id: "a" }));

      assert.deepEqual(buffer.normalMap?.zones, []);
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
      const buffer = enabledBuffer();
      const newer = arbiter.admit(buffer, command("normal-map-defaults-patched", {
        patch: { strength: 6 }
      }, { clientId: "B", timestamp: 900 }));
      newer?.commit();

      const older = arbiter.admit(buffer, command("normal-map-defaults-patched", {
        patch: { strength: 3 }
      }, { clientId: "A", timestamp: 500 }));
      const otherField = arbiter.admit(buffer, command("normal-map-defaults-patched", {
        patch: { invert: true }
      }, { clientId: "A", timestamp: 500 }));

      assert.equal(older, null);
      assert.notEqual(otherField, null);
    });

    test("a zone deletion conflicts with a newer set of the same zone", () => {
      const arbiter = new PixelCommandArbiter();
      const buffer = enabledBuffer();
      arbiter.admit(buffer, command("normal-map-zone-set", kZoneOff, {
        clientId: "B",
        timestamp: 900
      }))?.commit();

      const older = arbiter.admit(buffer, command("normal-map-zone-deleted", {
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
        arbiter.admit(enabledBuffer(), command("normal-map-toggled", {
          config
        })),
        null
      );
    });
  });

  test("snapshots carry the config", async() => {
    const buffer = enabledBuffer();
    applyCommandToBuffer(buffer, command("normal-map-zone-set", kZoneOff));
    const document = new PixelDocument({ size: { x: 1, y: 1 } });

    await loadPixelSnapshot(document, await encodePixelSnapshot(buffer));

    assert.deepEqual(document.normalMap?.toJSON(), buffer.normalMap?.toJSON());
  });
});
