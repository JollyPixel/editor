// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelDocument } from "../../src/document/VoxelDocument.ts";
import type { VoxelCommandOrigin } from "../../src/document/commands/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import { makeLogger } from "../helpers/fakes.ts";
import { CHUNK_SIZE, CUBE_ID } from "../helpers/ids.ts";

type Trace =
  | { event: "command"; action: string; origin: VoxelCommandOrigin; }
  | { event: "loaded"; };

function makeDocument(
  layers: string[] = ["Ground"]
): VoxelDocument {
  return new VoxelDocument({
    chunkSize: CHUNK_SIZE,
    layers,
    blocks: [makeBlockDef(CUBE_ID, "cube", { name: "Cube" })],
    blocksets: [makeAtlasDef()]
  });
}

function trace(
  document: VoxelDocument
): Trace[] {
  const events: Trace[] = [];
  document.on("command", (command, { origin }) => events.push({
    event: "command",
    action: command.action,
    origin
  }));
  document.on("loaded", () => events.push({ event: "loaded" }));

  return events;
}

describe("VoxelDocument.load", () => {
  it("keeps the blocks defined before a world loads", () => {
    const document = makeDocument();
    document.defineBlock(makeBlockDef(9, "cube"));

    document.load(document.save());

    assert.equal(document.blocks.has(9), true);
  });

  it("replays the world without emitting its commands, then announces it", () => {
    const source = makeDocument();
    source.world.setVoxel("Ground", {
      position: { x: 1, y: 0, z: 1 },
      blockId: CUBE_ID
    });

    const document = makeDocument([]);
    const events = trace(document);

    document.load(source.save());

    assert.deepEqual(events, [{ event: "loaded" }]);
    assert.equal(
      document.world.getVoxelAt({ x: 1, y: 0, z: 1 })?.blockId,
      CUBE_ID
    );
  });

  it("declares the extra blocksets after the snapshot replaced the list", () => {
    const source = makeDocument();
    const document = makeDocument([]);

    document.load(source.save(), {
      blocksets: [makeAtlasDef({ id: "stone" })]
    });

    assert.deepEqual(
      [...document.blocksets].map((def) => def.id).sort(),
      ["atlas", "stone"]
    );
  });

  it("merges every layer except the ones it is told to keep", () => {
    const source = makeDocument(["Base", "Ground", "Water", "Top"]);
    const document = makeDocument([]);

    document.load(source.save(), {
      mergeLayers: { except: ["Water"] }
    });

    assert.deepEqual(
      document.world.getLayers().map((layer) => layer.name),
      ["Top", "Water", "Base"]
    );
  });

  it("warns about a kept layer the loaded world does not have", () => {
    const warnings: string[] = [];
    const document = new VoxelDocument({
      chunkSize: CHUNK_SIZE,
      logger: makeLogger(warnings)
    });

    document.load(makeDocument(["Base", "Top"]).save(), {
      mergeLayers: { except: ["Water"] }
    });

    assert.equal(document.world.getLayers().length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /'Water'/);
  });
});
