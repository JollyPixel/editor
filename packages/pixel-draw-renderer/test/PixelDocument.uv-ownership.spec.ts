// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  createDocument,
  pixelAt
} from "./helpers/document/document.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

describe("PixelDocument", () => {
  describe("disownUvRegions", () => {
    function isExternal(
      id: string
    ): boolean {
      return id.startsWith("ext:");
    }

    function stackedRegion(
      id: string
    ) {
      return {
        state: "stacked" as const,
        id,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        color: "#f00"
      };
    }

    test("owns every region by default and takes the regions back once every filter is released", () => {
      const doc = createDocument();
      assert.equal(doc.ownsUvRegion("ext:a"), true);

      const releaseExternal = doc.disownUvRegions(isExternal);
      const releaseA = doc.disownUvRegions((id) => id === "ext:a");

      releaseExternal();
      assert.equal(doc.ownsUvRegion("ext:a"), false);
      assert.equal(doc.ownsUvRegion("ext:b"), true);

      releaseA();
      assert.equal(doc.ownsUvRegion("ext:a"), true);
    });

    test("edits an external region without commands or history", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      doc.disownUvRegions(isExternal);

      const region = doc.uv.create({
        id: "ext:a",
        width: 4,
        height: 4,
        state: "stacked"
      });
      doc.uv.move(region.id, { x: 2, y: 2, width: 4, height: 4 });
      assert.equal(doc.uv.rotate(region.id, "cw"), true);
      assert.equal(doc.uv.setState(region.id, "unfolded"), true);
      doc.uv.delete(region.id);

      assert.equal(doc.uv.get(region.id), undefined);
      assert.equal(doc.history.canUndo, false);
      assert.deepEqual(events, []);
    });

    test("keeps commands for owned regions and pixel edits", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      doc.disownUvRegions(isExternal);

      doc.uv.create({
        id: "ext:a",
        width: 4,
        height: 4
      });
      doc.uv.create({
        id: "own",
        width: 4,
        height: 4
      });
      doc.paintPixels([{ x: 0, y: 0 }], kRed);

      assert.deepEqual(
        events.map((event) => event.action),
        ["uv-region-created", "stroke"]
      );
    });

    test("ignores remote commands and snapshot regions for external regions", () => {
      const doc = createDocument();
      doc.disownUvRegions(isExternal);
      doc.uv.create({
        id: "ext:kept",
        width: 4,
        height: 4
      });

      doc.applyRemoteCommand({
        action: "uv-region-created",
        metadata: { region: stackedRegion("ext:remote") }
      });
      doc.applyRemoteCommand({
        action: "uv-region-deleted",
        metadata: { id: "ext:kept" }
      });
      doc.loadSnapshot(
        { x: 1, y: 1 },
        new Uint8ClampedArray([1, 2, 3, 255]),
        [
          stackedRegion("ext:stored"),
          stackedRegion("own")
        ]
      );

      assert.deepEqual(
        [...doc.uv.regions].map((region) => region.id).sort(),
        ["ext:kept", "own"]
      );
      assert.deepEqual(pixelAt(doc, 0, 0), [1, 2, 3, 255]);
    });
  });
});
