// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockRegistry } from "../../../src/document/blocks/index.ts";
import {
  blockDefinedCmd,
  blockMovedCmd
} from "../../helpers/networkCommands.ts";

describe("BlockRegistry.apply — custom properties", () => {
  it("registers the properties carried by the command", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3, liquid: false };

    assert.equal(registry.applyCommand(command, null)?.action, "block-defined");
    assert.deepEqual(registry.copyProperties(7), {
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

    registry.applyCommand(command, null);

    assert.deepEqual(registry.copyProperties(7), { kept: "yes" });
  });

  it("fills the default blockset into texture references naming none", () => {
    const registry = new BlockRegistry();

    const applied = registry.applyCommand(blockDefinedCmd({ id: 7 }), "stone");

    assert.equal(applied?.action, "block-defined");
    assert.equal(applied.block.defaultTexture?.blocksetId, "stone");
    assert.equal(registry.get(7)?.defaultTexture?.blocksetId, "stone");
  });

  it("does not alias the command payload into the registry", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3 };

    registry.applyCommand(command, null);
    command.block.properties.hardness = 99;

    assert.deepEqual(registry.copyProperties(7), { hardness: 3 });
  });
});

describe("BlockRegistry.apply — reorder", () => {
  function seeded(): BlockRegistry {
    const registry = new BlockRegistry();
    for (const id of [1, 2, 3]) {
      registry.applyCommand(blockDefinedCmd({ id }), null);
    }

    return registry;
  }

  it("moves the block named by the command", () => {
    const registry = seeded();

    assert.deepEqual(
      registry.applyCommand(blockMovedCmd({ blockId: 3, toIndex: 0 }), null),
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
      registry.applyCommand(blockMovedCmd({ blockId: 1, toIndex: 0 }), null),
      null
    );
  });

  it("returns the move with the index the block landed on", () => {
    const registry = seeded();

    assert.deepEqual(
      registry.applyCommand(blockMovedCmd({ blockId: 1, toIndex: 99 }), null),
      blockMovedCmd({ blockId: 1, toIndex: 2 })
    );
  });

  it("ignores a move naming an unknown block", () => {
    const registry = seeded();

    assert.equal(
      registry.applyCommand(blockMovedCmd({ blockId: 404, toIndex: 0 }), null),
      null
    );
    assert.deepEqual(
      [...registry].map((block) => block.id),
      [1, 2, 3]
    );
  });
});
