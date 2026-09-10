// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { applyBlockCommand } from "../../src/network/applyBlockCommand.ts";
import { BlockRegistry } from "../../src/blocks/index.ts";
import { blockDefinedCmd } from "../helpers/networkCommands.ts";

describe("applyBlockCommand — custom properties", () => {
  it("registers the properties carried by the command", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3, liquid: false };

    assert.equal(applyBlockCommand(registry, command), true);
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

    applyBlockCommand(registry, command);

    assert.deepEqual(registry.propertiesOf(7), { kept: "yes" });
  });

  it("does not alias the command payload into the registry", () => {
    const registry = new BlockRegistry();
    const command = blockDefinedCmd({ id: 7 });
    assert.equal(command.action, "block-defined");
    command.block.properties = { hardness: 3 };

    applyBlockCommand(registry, command);
    command.block.properties.hardness = 99;

    assert.deepEqual(registry.propertiesOf(7), { hardness: 3 });
  });
});
