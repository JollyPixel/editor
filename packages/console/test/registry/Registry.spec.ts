// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import { withNested } from "../helpers/registry/withNested.ts";

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

  test("iteration follows registrations made after an earlier pass", () => {
    const commands = new CommandConsole();
    const brush = commands.registerNamespace("brush");
    const scope = commands.registry.namespace("brush");
    assert.ok(scope);
    function addresses(): string[] {
      return [...scope!].map((entry) => entry.address);
    }

    assert.deepEqual(addresses(), []);

    const grow = brush.registerCommand("grow", {
      description: "Grow the brush",
      args: [],
      execute: () => undefined
    });

    assert.deepEqual(addresses(), ["brush.grow"]);

    const size = brush.registerVariable("size", {
      type: "number",
      description: "Brush size",
      get: () => 1,
      set: () => undefined
    });

    assert.deepEqual(addresses(), ["brush.grow", "brush.size"]);
    assert.deepEqual([...scope.commands()].map((entry) => entry.address), ["brush.grow"]);

    grow.unregister();

    assert.deepEqual(addresses(), ["brush.size"]);
    assert.deepEqual([...scope.commands()], []);

    size.unregister();

    assert.deepEqual(addresses(), []);
    assert.ok([...commands.registry.root].length > 0);

    commands.unregister();

    assert.deepEqual([...commands.registry.root], []);
  });

  test("entries carry their address and description", () => {
    const { registry } = createConsole();

    assert.equal(registry.namespace("brush")?.address, "brush");
    assert.equal(registry.namespace("brush")?.description, "Voxel brush");
    assert.equal(registry.resolveCommand("brush.grow")?.description, "Grow the brush");
    assert.equal(registry.resolveVariable("brush.size")?.description, "Brush size");
  });
});

describe("nested namespaces", () => {
  test("a nested namespace makes its parent exist and resolves addresses at the last dot", () => {
    const { registry } = withNested().commands;
    const pixelart = registry.namespace("pixelart");
    assert.ok(pixelart);

    assert.deepEqual([pixelart.name, pixelart.description, pixelart.implicit], ["pixelart", "", true]);
    assert.deepEqual(
      [...registry.children(registry.root)].map((namespace) => namespace.address),
      ["pixelart", "brush"]
    );
    assert.deepEqual(
      [...registry.children(pixelart)].map((namespace) => namespace.name),
      ["keybinds", "preview"]
    );
    assert.equal(registry.resolveVariable("pixelart.keybinds.undo")?.name, "undo");
    assert.equal(registry.resolveCommand("pixelart.keybinds.reset")?.namespace.address, "pixelart.keybinds");
    assert.equal(registry.resolveVariable("pixelart.undo"), undefined);
  });

  test("a parent registered on its own keeps its children, and leaves with the last of them", () => {
    const commands = new CommandConsole();
    const child = commands.registerNamespace("a.b");
    const parent = commands.registerNamespace("a", { description: "Parent" });

    assert.equal(commands.registry.namespace("a")?.description, "Parent");
    assert.equal(commands.registry.namespace("a")?.implicit, false);

    parent.unregister();

    assert.equal(commands.registry.namespace("a")?.implicit, true);
    assert.ok(commands.registry.namespace("a.b"));

    child.unregister();

    assert.equal(commands.registry.namespace("a"), undefined);
  });
});
