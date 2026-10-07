// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MessageParser,
  MessageProtocol
} from "@jolly-pixel/network";
import { NormalMapConfig } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blocksetCommandProtocol,
  blocksetSnapshotSchema
} from "#src/network/blockset/BlocksetCommand.schema.ts";

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
  return new MessageParser(blocksetCommandProtocol).parse(payload).ok;
}

describe("blocksetCommandProtocol", () => {
  test("accepts a pixel stroke and parses it to its action", () => {
    const parsed = new MessageParser(blocksetCommandProtocol).parse({
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
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-renamed",
      groupId: "wet",
      to: "soaked"
    }), true);
  });

  test("accepts normal map commands and a material group normal scale", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "normal-map-toggled",
      metadata: {
        config: NormalMapConfig.create().toJSON()
      }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "normal-map-zone-set",
      metadata: {
        zone: { regionId: "block-1", settings: "off" },
        index: 0
      }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "stone", normalScale: 2.5 }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "stone", normalScale: -1 }
    }), false);
  });

  test("accepts a material group swatch colour only as #rrggbb", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "gold", swatch: "#FFaa00" }
    }), true);
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-defined",
      group: { id: "gold", swatch: "gold" }
    }), false);
  });

  test("accepts a material group light level only as an integer from 0 to 15", () => {
    for (const [lightLevel, valid] of [[15, true], [0, true], [16, false], [7.5, false]] as const) {
      assert.strictEqual(accepts({
        ...kHeader,
        action: "material-group-defined",
        group: { id: "glowstone", lightLevel }
      }), valid);
    }
  });

  test("rejects a layer command, a bad finish or a bad tile size", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "voxel-set",
      layerId: "Ground",
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
    assert.strictEqual(accepts({
      ...kHeader,
      action: "material-group-renamed",
      groupId: "wet",
      to: ""
    }), false);
  });
});

describe("blocksetSnapshotSchema", () => {
  test("requires pixels next to the document fields", () => {
    const parser = new MessageParser(new MessageProtocol({
      title: "snapshot",
      ...blocksetSnapshotSchema
    }));
    const snapshot = {
      tileSize: 8,
      pixels: { size: { x: 8, y: 8 }, pixels: "" },
      blocks: [],
      materialGroups: [{ id: "gold" }]
    };

    assert.strictEqual(parser.parse(snapshot).ok, true);
    assert.strictEqual(parser.parse({
      ...snapshot,
      pixels: {
        ...snapshot.pixels,
        normalMap: NormalMapConfig.create().toJSON()
      }
    }).ok, true);
    assert.strictEqual(parser.parse({ ...snapshot, pixels: {} }).ok, false);
    assert.strictEqual(
      parser.parse({ ...snapshot, materialGroups: [{ id: "" }] }).ok,
      false
    );
  });
});
