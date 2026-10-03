// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import type { IslandFace } from "#src/normal/types.ts";

function createDocument(
  events: PixelBufferHookEvent[] = []
): PixelDocument {
  return new PixelDocument({
    size: { x: 8, y: 8 },
    history: { enabled: true, limit: 50 },
    onBufferUpdated: (event) => events.push(event)
  });
}

function addRegion(
  doc: PixelDocument,
  id: string
): void {
  doc.uv.restore({
    id,
    color: "#fff",
    state: "stacked",
    rect: { x: 0, y: 0, width: 2, height: 2 }
  });
}

function zoneIds(
  doc: PixelDocument
): string[] {
  return doc.normalMap?.zones.map((zone) => zone.regionId) ?? [];
}

describe("PixelDocument normal map", () => {
  test("is off by default", () => {
    assert.equal(createDocument().normalMap, null);
  });

  test("enable and disable are undoable commands", () => {
    const events: PixelBufferHookEvent[] = [];
    const doc = createDocument(events);
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

    assert.equal(doc.undo()?.action, "normal-map");
    assert.notEqual(doc.normalMap, null);
    assert.equal(events.at(-1)?.action, "normal-map-toggled");
    assert.equal(doc.undo()?.action, "normal-map");
    assert.equal(doc.normalMap, null);
    assert.deepEqual(changes, [null, null, null, null]);
  });

  test("patching defaults sends only the patched fields", () => {
    const events: PixelBufferHookEvent[] = [];
    const doc = createDocument(events);
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
    const events: PixelBufferHookEvent[] = [];
    const doc = createDocument(events);
    doc.enableNormalMap();
    events.length = 0;

    assert.throws(() => doc.patchNormalMapDefaults({ strength: -1 }));

    assert.equal(events.length, 0);
    assert.equal(doc.normalMap?.defaults.strength, 2);
  });

  test("edits are ignored while the feature is off", () => {
    const events: PixelBufferHookEvent[] = [];
    const doc = createDocument(events);

    doc.patchNormalMapDefaults({ strength: 5 });
    doc.setNormalMapZone({ regionId: "a", settings: "off" });
    doc.deleteNormalMapZone("a");
    doc.disableNormalMap();

    assert.equal(events.length, 0);
    assert.equal(doc.history.canUndo, false);
  });

  describe("zones", () => {
    test("setting a new zone undoes as a deletion", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.enableNormalMap();
      const changes: (string[] | null)[] = [];
      doc.on("normal-map-changed", (event) => changes.push(event.regionIds));

      doc.setNormalMapZone({ regionId: "a", settings: { invert: true } });
      assert.deepEqual(events.at(-1), {
        action: "normal-map-zone-set",
        metadata: {
          zone: { regionId: "a", settings: { invert: true } },
          index: 0
        }
      });

      doc.undo();
      assert.deepEqual(zoneIds(doc), []);
      assert.deepEqual(events.at(-1), {
        action: "normal-map-zone-deleted",
        metadata: { regionId: "a" },
        originTimestamp: events.at(-1)?.originTimestamp
      });
      assert.deepEqual(changes, [["a"], ["a"]]);
    });

    test("undoing a replacement restores the previous zone", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.enableNormalMap();
      doc.setNormalMapZone({ regionId: "a", settings: { invert: true } });

      doc.setNormalMapZone({ regionId: "a", settings: "off" });
      assert.deepEqual(events.at(-1)?.metadata, {
        zone: { regionId: "a", settings: "off" },
        index: 0
      });

      doc.undo();
      assert.deepEqual(doc.normalMap?.zoneOf("a")?.settings, { invert: true });
    });

    test("undoing a deletion restores the zone at its index", () => {
      const doc = createDocument();
      doc.enableNormalMap();
      for (const regionId of ["a", "b", "c"]) {
        doc.setNormalMapZone({ regionId, settings: "off" });
      }

      doc.deleteNormalMapZone("b");
      assert.deepEqual(zoneIds(doc), ["a", "c"]);
      doc.undo();

      assert.deepEqual(zoneIds(doc), ["a", "b", "c"]);
    });

    test("redoing a new zone puts it back at its index", () => {
      const doc = createDocument();
      doc.enableNormalMap();
      doc.setNormalMapZone({ regionId: "a", settings: "off" });
      doc.undo();
      doc.applyRemoteCommand({
        action: "normal-map-zone-set",
        metadata: { zone: { regionId: "b", settings: "off" }, index: 0 }
      });

      doc.redo();

      assert.deepEqual(zoneIds(doc), ["a", "b"]);
    });

    test("deleting an owned UV region removes its zone in the same entry", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.enableNormalMap();
      addRegion(doc, "a");
      addRegion(doc, "b");
      doc.setNormalMapZone({ regionId: "a", settings: "off" });
      doc.setNormalMapZone({ regionId: "b", settings: "off" });

      doc.uv.delete("a");
      assert.deepEqual(zoneIds(doc), ["b"]);
      assert.deepEqual(events.at(-1), {
        action: "uv-region-deleted",
        metadata: { id: "a" }
      });

      assert.equal(doc.undo()?.action, "uv-delete");
      assert.notEqual(doc.uv.get("a"), undefined);
      assert.deepEqual(zoneIds(doc), ["a", "b"]);
      assert.deepEqual(
        events.slice(-2).map((event) => event.action),
        ["uv-region-created", "normal-map-zone-set"]
      );

      doc.redo();
      assert.deepEqual(zoneIds(doc), ["b"]);
    });

    test("an external region keeps its zone when deleted", () => {
      const doc = createDocument();
      doc.enableNormalMap();
      doc.disownUvRegions((id) => id === "block");
      addRegion(doc, "block");
      doc.setNormalMapZone({ regionId: "block", settings: "off" });

      doc.uv.delete("block");

      assert.deepEqual(zoneIds(doc), ["block"]);
    });
  });

  describe("remote commands", () => {
    test("apply without history or echo", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);

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
      const doc = createDocument();
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
    const doc = createDocument();
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

  describe("islands", () => {
    test("are kept until a UV region changes", () => {
      const doc = createDocument();
      let changes = 0;
      doc.on("islands-changed", () => changes++);
      const islands = doc.islands;

      assert.equal(doc.islands, islands);

      addRegion(doc, "tile");

      assert.equal(changes, 1);
      assert.notEqual(doc.islands, islands);
      assert.equal(doc.islands.islandsOf("tile").length, 1);
    });

    test("are rebuilt after a resize", () => {
      const doc = createDocument();
      let changes = 0;
      doc.on("islands-changed", () => changes++);
      const islands = doc.islands;

      doc.resize({ x: 4, y: 4 });

      assert.equal(changes, 1);
      assert.notEqual(doc.islands, islands);
    });

    test("an idle normal map reads the current islands", () => {
      const doc = createDocument();
      assert.equal(doc.normals.islands.islandsOf("tile").length, 0);

      addRegion(doc, "tile");

      assert.equal(doc.normals.islands.islandsOf("tile").length, 1);
    });

    test("follow the supplied faces instead of the UV regions", () => {
      const doc = createDocument();
      const faces: IslandFace[] = [{
        regionId: "brick",
        geometry: { x: 0, y: 0, width: 4, height: 4 }
      }];
      let changes = 0;
      doc.on("islands-changed", () => changes++);

      const release = doc.useIslandFaces(() => faces);
      addRegion(doc, "tile");

      assert.equal(changes, 1);
      assert.equal(doc.islands.islandsOf("brick").length, 1);
      assert.equal(doc.islands.islandsOf("tile").length, 0);

      faces.push({
        regionId: "glass",
        geometry: { x: 4, y: 4, width: 4, height: 4 }
      });
      doc.invalidateIslands();

      assert.equal(changes, 2);
      assert.equal(doc.islands.islandsOf("glass").length, 1);

      release();

      assert.equal(changes, 3);
      assert.equal(doc.islands.islandsOf("brick").length, 0);
      assert.equal(doc.islands.islandsOf("tile").length, 1);
    });

    test("a stale release keeps the newer faces", () => {
      const doc = createDocument();
      const release = doc.useIslandFaces(() => []);
      doc.useIslandFaces(() => [{
        regionId: "brick",
        geometry: { x: 0, y: 0, width: 4, height: 4 }
      }]);

      release();

      assert.equal(doc.islands.islandsOf("brick").length, 1);
    });
  });
});
