// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  addRegion,
  createNormalMapDocument,
  zoneIds
} from "./helpers/document/normalMap.ts";

describe("PixelDocument normal map", () => {
  describe("zones", () => {
    test("setting a new zone undoes as a deletion", () => {
      const events: PixelCommand[] = [];
      const doc = createNormalMapDocument(events);
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
      const events: PixelCommand[] = [];
      const doc = createNormalMapDocument(events);
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
      const doc = createNormalMapDocument();
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
      const doc = createNormalMapDocument();
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
      const events: PixelCommand[] = [];
      const doc = createNormalMapDocument(events);
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

      assert.deepEqual(
        doc.undo()?.undo.map(({ action }) => action),
        ["uv-region-created", "normal-map-zone-set"]
      );
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
      const doc = createNormalMapDocument();
      doc.enableNormalMap();
      doc.disownUvRegions((id) => id === "block");
      addRegion(doc, "block");
      doc.setNormalMapZone({ regionId: "block", settings: "off" });

      doc.uv.delete("block");

      assert.deepEqual(zoneIds(doc), ["block"]);
    });
  });
});
