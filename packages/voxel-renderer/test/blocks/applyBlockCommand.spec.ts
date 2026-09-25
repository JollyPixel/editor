// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyBlockCommand,
  BlockRegistry
} from "../../src/blocks/index.ts";
import {
  blockDefinedCmd,
  blockMovedCmd
} from "../helpers/networkCommands.ts";

describe("applyBlockCommand — custom properties", () => {
  it("registers the properties carried by the command", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3, liquid: false };

    assert.equal(applyBlockCommand(registry, command, null)?.action, "block-defined");
    assert.deepEqual(registry.propertiesOf(7), {
      hardness: 3,
      liquid: false
    });
  });

  it("scrubs a non-scalar property sent by a remote peer", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = {
      kept: "yes",
      nested: { deep: true }
    } as never;

    applyBlockCommand(registry, command, null);

    assert.deepEqual(registry.propertiesOf(7), { kept: "yes" });
  });

  it("fills the default tileset into texture references naming none", () => {
    const registry = new BlockRegistry();

    const applied = applyBlockCommand(registry, blockDefinedCmd({ id: 7 }), "stone");

    assert.equal(applied?.action, "block-defined");
    assert.equal(applied.block.defaultTexture?.tilesetId, "stone");
    assert.equal(registry.get(7)?.defaultTexture?.tilesetId, "stone");
  });

  it("does not alias the command payload into the registry", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3 };

    applyBlockCommand(registry, command, null);
    command.block.properties.hardness = 99;

    assert.deepEqual(registry.propertiesOf(7), { hardness: 3 });
  });
});

describe("applyBlockCommand — reorder", () => {
  function seeded(): BlockRegistry {
    const registry = new BlockRegistry();
    for (const id of [1, 2, 3]) {
      applyBlockCommand(registry, blockDefinedCmd({ id }), null);
    }

    return registry;
  }

  it("moves the block named by the command", () => {
    const registry = seeded();

    assert.deepEqual(
      applyBlockCommand(registry, blockMovedCmd({ blockId: 3, toIndex: 0 }), null),
      blockMovedCmd({ blockId: 3, toIndex: 0 })
    );
    assert.deepEqual(
      [...registry].map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("reports no change when the block already sits at the index", () => {
    const registry = seeded();

    assert.equal(
      applyBlockCommand(registry, blockMovedCmd({ blockId: 1, toIndex: 0 }), null),
      null
    );
  });

  it("returns the move with the index the block landed on", () => {
    const registry = seeded();

    assert.deepEqual(
      applyBlockCommand(registry, blockMovedCmd({ blockId: 1, toIndex: 99 }), null),
      blockMovedCmd({ blockId: 1, toIndex: 2 })
    );
  });

  it("ignores a move naming an unknown block", () => {
    const registry = seeded();

    assert.equal(
      applyBlockCommand(registry, blockMovedCmd({ blockId: 404, toIndex: 0 }), null),
      null
    );
    assert.deepEqual(
      [...registry].map((block) => block.id),
      [1, 2, 3]
    );
  });
});
