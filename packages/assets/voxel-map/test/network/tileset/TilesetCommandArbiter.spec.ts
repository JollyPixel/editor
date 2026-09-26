// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import type { PixelNetworkCommand } from "@jolly-pixel/asset.pixel-art/network/client.ts";

// Import Internal Dependencies
import {
  TilesetCommandArbiter,
  type TilesetDocumentNetworkCommand
} from "#src/network/server.ts";
import { makeResolvedBlockDef } from "../../helpers/blocks.ts";

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

function harness() {
  return {
    arbiter: new TilesetCommandArbiter(),
    state: {
      pixels: new PixelBuffer({ size: { x: 4, y: 4 } })
    }
  };
}

function blockDefined(
  id: number,
  header: Partial<typeof kHeader> = {}
): TilesetDocumentNetworkCommand {
  return {
    ...kHeader,
    ...header,
    action: "block-defined",
    block: makeResolvedBlockDef(id, "cube")
  };
}

function stroke(
  positions: { x: number; y: number; }[],
  header: Partial<typeof kHeader> = {}
): PixelNetworkCommand {
  return {
    ...kHeader,
    ...header,
    action: "stroke",
    metadata: {
      color: kBlack,
      positions
    }
  };
}

describe("TilesetCommandArbiter", () => {
  test("keys document commands by block, material group or tile size", () => {
    assert.strictEqual(TilesetCommandArbiter.key(blockDefined(4)), "block:4");
    assert.strictEqual(
      TilesetCommandArbiter.key({
        ...kHeader,
        action: "block-moved",
        blockId: 4,
        toIndex: 1
      }),
      "block:4"
    );
    assert.strictEqual(
      TilesetCommandArbiter.key({
        ...kHeader,
        action: "material-group-removed",
        groupId: "gold"
      }),
      "material-group:gold"
    );
    assert.strictEqual(
      TilesetCommandArbiter.key({
        ...kHeader,
        action: "tile-size-updated",
        tileSize: 16
      }),
      "tile-size"
    );
  });

  test("an older edit of the same block loses, another block passes", () => {
    const { arbiter, state } = harness();

    arbiter.admit(state, blockDefined(4, { timestamp: 2000 }))!.commit();

    assert.strictEqual(
      arbiter.admit(state, blockDefined(4, { clientId: "late", timestamp: 1000 })),
      null
    );
    assert.notStrictEqual(
      arbiter.admit(state, blockDefined(5, { clientId: "late", timestamp: 1000 })),
      null
    );
  });

  test("refuses a block the tileset document could not define", () => {
    const { arbiter, state } = harness();

    assert.strictEqual(
      arbiter.admit(state, {
        ...kHeader,
        action: "block-defined",
        block: {
          ...makeResolvedBlockDef(4, "cube"),
          alphaCutoff: 2
        }
      }),
      null
    );
    assert.strictEqual(arbiter.admit(state, blockDefined(0x10000)), null);
  });

  test("a stroke is narrowed to the pixels that win, apart from block edits", () => {
    const { arbiter, state } = harness();

    arbiter.admit(state, stroke([{ x: 1, y: 0 }], { timestamp: 2000 }))!.commit();
    arbiter.admit(state, blockDefined(4, { timestamp: 2000 }))!.commit();

    const contested = arbiter.admit(state, stroke(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      { clientId: "late", timestamp: 1000 }
    ));

    assert.deepEqual(
      contested?.command.action === "stroke" ?
        contested.command.metadata.positions :
        null,
      [{ x: 0, y: 0 }]
    );
    assert.strictEqual(
      arbiter.admit(state, stroke([{ x: 1, y: 0 }], { clientId: "late", timestamp: 1000 })),
      null
    );
  });
});
