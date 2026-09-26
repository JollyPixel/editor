// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  tilesetCommandProtocol,
  tilesetSnapshotSchema
} from "#src/network/tileset/TilesetCommand.schema.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kBlack = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

function accepts(
  payload: unknown
): boolean {
  return new MessageParser(tilesetCommandProtocol).parse(payload).ok;
}

describe("tilesetCommandProtocol", () => {
  test("accepts a pixel stroke and parses it to its action", () => {
    const parsed = new MessageParser(tilesetCommandProtocol).parse({
      ...kHeader,
      action: "stroke",
      metadata: {
        color: kBlack,
        positions: [{ x: 0, y: 0 }]
      }
    });

    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "stroke");
  });

  test("accepts block, material group and tile size commands", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-defined",
      block: { id: 3, name: "slope", shapeId: "slope" }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-moved",
      blockId: 3,
      toIndex: 0
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "gold", roughness: 0.3, metalness: 1, emissive: "#FFaa00" }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tile-size-updated",
      tileSize: 16
    }), true);
  });

  test("rejects a layer command, a bad finish or a bad tile size", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "voxel-set",
      layerName: "Ground",
      metadata: {}
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-defined",
      block: { id: 0, name: "Stone", shapeId: "cube" }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-defined",
      block: { id: 0x10000, name: "Stone", shapeId: "cube" }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "block-defined",
      block: { id: 1 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "gold", metalness: 2 }
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tile-size-updated",
      tileSize: 1.5
    }), false);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "tile-size-updated",
      tileSize: 8192
    }), false);
  });
});

describe("tilesetSnapshotSchema", () => {
  test("requires pixels next to the document fields", () => {
    const parser = new MessageParser({
      schema: {
        title: "snapshot",
        ...tilesetSnapshotSchema
      }
    });
    const snapshot = {
      tileSize: 8,
      pixels: { size: { x: 8, y: 8 }, pixels: "" },
      blocks: [],
      materialGroups: [{ id: "gold" }]
    };

    assert.strictEqual(parser.parse(snapshot).ok, true);
    assert.strictEqual(parser.parse({ ...snapshot, pixels: {} }).ok, false);
    assert.strictEqual(
      parser.parse({ ...snapshot, materialGroups: [{ id: "" }] }).ok,
      false
    );
  });
});
