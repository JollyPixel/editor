// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const brush = commands.registerNamespace("brush", { description: "Voxel brush" });
  brush.registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => 1,
    set: () => undefined
  });
  brush.registerCommand("grow", {
    description: "Grow the brush",
    args: [],
    execute: () => undefined
  });
  commands.registerNamespace("audio");

  return commands;
}

describe("Registry", () => {
  test("iterates the root scope first, then every namespace", () => {
    const { registry } = createConsole();

    assert.deepEqual([...registry].map((scope) => scope.address), ["", "brush", "audio"]);
    assert.equal([...registry][0], registry.root);
  });

  test("a namespace iterates its commands, then its variables", () => {
    const brush = createConsole().registry.namespace("brush");
    assert.ok(brush);

    assert.deepEqual([...brush].map((entry) => [entry.kind, entry.address]), [
      ["command", "brush.grow"],
      ["variable", "brush.size"]
    ]);
  });

  test("entries carry their address and description", () => {
    const { registry } = createConsole();

    assert.equal(registry.namespace("brush")?.address, "brush");
    assert.equal(registry.namespace("brush")?.description, "Voxel brush");
    assert.equal(registry.resolveCommand("brush.grow")?.description, "Grow the brush");
    assert.equal(registry.resolveVariable("brush.size")?.description, "Brush size");
  });
});
