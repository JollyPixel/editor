// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { CommandConsole } from "#src/index.ts";
import { withNested } from "../helpers/registry/withNested.ts";

function lines(
  commands: CommandConsole
): string[] {
  return commands.scrollback.map((entry) => `${entry.kind}: ${entry.text}`);
}

describe("/cd", () => {
  test("names inside the scope resolve without it and win over the root", async() => {
    const { commands, bindings, resets } = withNested();

    await commands.submit("/cd pixelart.keybinds");
    await commands.submit("undo mod+u");
    await commands.submit("/reset");

    assert.equal(commands.scope.address, "pixelart.keybinds");
    assert.equal(bindings.get("undo"), "mod+u");
    assert.deepEqual(resets, ["pixelart.keybinds"]);
  });

  test("full addresses and root commands still resolve from a scope", async() => {
    const { commands, resets } = withNested();

    await commands.submit("/cd pixelart.keybinds");
    await commands.submit("/brush.reset");
    await commands.submit("/cd ..");

    assert.deepEqual(resets, ["brush"]);
    assert.equal(commands.scope.address, "pixelart");
  });

  test("enters relative to the scope, goes up with .., and back to the root with no name", async() => {
    const { commands } = withNested();
    const changes: string[] = [];
    commands.on("scope-changed", () => changes.push(commands.scope.address));

    await commands.submit("/cd pixelart");
    await commands.submit("/cd keybinds");
    await commands.submit("/cd keybinds");
    await commands.submit("/cd ..");
    await commands.submit("/cd");
    await commands.submit("/cd ..");

    assert.deepEqual(changes, ["pixelart", "pixelart.keybinds", "pixelart", ""]);
    assert.deepEqual(lines(commands).filter((line) => line.startsWith("error")), [
      "error: Unknown namespace \"keybinds\""
    ]);
  });

  test("an unknown namespace is an error that keeps the scope", async() => {
    const { commands } = withNested();

    await commands.submit("/cd pixelart");
    await commands.submit("/cd pixelart.keybind");

    assert.equal(commands.scope.address, "pixelart");
    assert.equal(
      lines(commands).at(-1),
      "error: Unknown namespace \"pixelart.keybind\". Did you mean pixelart.keybinds?"
    );
  });

  test("falls back to the nearest namespace still registered, and returns with it", async() => {
    const { commands } = withNested();
    function register() {
      return commands.registerNamespace("pixelart.layers");
    }
    const layers = register();

    await commands.submit("/cd pixelart.layers");
    layers.unregister();

    assert.equal(commands.scope.address, "pixelart");

    register();

    assert.equal(commands.scope.address, "pixelart.layers");
  });

  test("/help with no name describes the scope and its nested namespaces", async() => {
    const { commands } = withNested();

    await commands.submit("/cd pixelart");
    await commands.submit("/help");

    assert.equal(commands.scrollback.at(-1)?.text, [
      "pixelart",
      "Namespaces",
      "  pixelart.keybinds  Pixel-art keyboard shortcuts",
      "  pixelart.preview"
    ].join("\n"));
  });
});
