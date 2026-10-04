// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import {
  InvalidNormalMapSettingsError
} from "#src/normal/errors/InvalidNormalMapSettingsError.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  addRegion,
  createNormalMapDocument,
  zoneIds
} from "./helpers/document/normalMap.ts";

describe("PixelDocument normal map", () => {
  test("is off by default", () => {
    assert.equal(createNormalMapDocument().normalMap, null);
  });

  test("enable and disable are undoable commands", () => {
    const events: PixelCommand[] = [];
    const doc = createNormalMapDocument(events);
    const changes: (string[] | null)[] = [];
    doc.on("normal-map-changed", (event) => changes.push(event.regionIds));

    doc.enableNormalMap();
    assert.deepEqual(doc.normalMap?.toJSON(), NormalMapConfig.create().toJSON());
    assert.deepEqual(events.at(-1), {
      action: "normal-map-toggled",
      metadata: {
        config: NormalMapConfig.create().toJSON()
      }
    });

    doc.disableNormalMap();
    assert.equal(doc.normalMap, null);

    assert.equal(doc.undo()?.undo[0].action, "normal-map-toggled");
    assert.notEqual(doc.normalMap, null);
    assert.equal(events.at(-1)?.action, "normal-map-toggled");
    assert.equal(doc.undo()?.undo[0].action, "normal-map-toggled");
    assert.equal(doc.normalMap, null);
    assert.deepEqual(changes, [null, null, null, null]);
  });

  test("patching defaults sends only the patched fields", () => {
    const events: PixelCommand[] = [];
    const doc = createNormalMapDocument(events);
    doc.enableNormalMap();

    doc.patchNormalMapDefaults({ strength: 5 });

    assert.deepEqual(events.at(-1), {
      action: "normal-map-defaults-patched",
      metadata: {
        patch: { strength: 5 }
      }
    });
    doc.undo();
    assert.equal(doc.normalMap?.defaults.strength, 2);
    assert.deepEqual(events.at(-1), {
      action: "normal-map-defaults-patched",
      metadata: {
        patch: { strength: 2 }
      },
      originTimestamp: events.at(-1)?.originTimestamp
    });
    doc.redo();
    assert.equal(doc.normalMap?.defaults.strength, 5);
  });

  test("an invalid patch throws without recording anything", () => {
    const events: PixelCommand[] = [];
    const doc = createNormalMapDocument(events);
    doc.enableNormalMap();
    events.length = 0;

    assert.throws(
      () => doc.patchNormalMapDefaults({ strength: -1 }),
      InvalidNormalMapSettingsError
    );

    assert.equal(events.length, 0);
    assert.equal(doc.normalMap?.defaults.strength, 2);
    assert.equal(doc.undo()?.undo[0].action, "normal-map-toggled");
    assert.equal(doc.normalMap, null);
    assert.equal(doc.history.canUndo, false);
  });

  test("edits are ignored while the feature is off", () => {
    const events: PixelCommand[] = [];
    const doc = createNormalMapDocument(events);

    doc.patchNormalMapDefaults({ strength: 5 });
    doc.setNormalMapZone({ regionId: "a", settings: "off" });
    doc.deleteNormalMapZone("a");
    doc.disableNormalMap();

    assert.equal(events.length, 0);
    assert.equal(doc.history.canUndo, false);
  });

  describe("remote commands", () => {
    test("apply without history or echo", () => {
      const events: PixelCommand[] = [];
      const doc = createNormalMapDocument(events);

      doc.applyRemoteCommand({
        action: "normal-map-toggled",
        metadata: {
          config: NormalMapConfig.create().toJSON()
        }
      });
      doc.applyRemoteCommand({
        action: "normal-map-zone-set",
        metadata: { zone: { regionId: "a", settings: "off" }, index: 0 }
      });

      assert.deepEqual(zoneIds(doc), ["a"]);
      assert.equal(events.length, 0);
      assert.equal(doc.history.canUndo, false);
    });

    test("a remote region deletion removes its zone", () => {
      const doc = createNormalMapDocument();
      doc.enableNormalMap();
      addRegion(doc, "a");
      doc.setNormalMapZone({ regionId: "a", settings: "off" });

      doc.applyRemoteCommand({
        action: "uv-region-deleted",
        metadata: { id: "a" }
      });

      assert.deepEqual(zoneIds(doc), []);
    });
  });

  test("loadSnapshot replaces the config and clears history", () => {
    const doc = createNormalMapDocument();
    doc.enableNormalMap();

    doc.loadSnapshot(
      { x: 2, y: 2 },
      new Uint8ClampedArray(16),
      [],
      NormalMapConfig.create({ strength: 3 }).toJSON()
    );
    assert.equal(doc.normalMap?.defaults.strength, 3);
    assert.equal(doc.history.canUndo, false);

    doc.loadSnapshot({ x: 2, y: 2 }, new Uint8ClampedArray(16));
    assert.equal(doc.normalMap, null);
  });
});
