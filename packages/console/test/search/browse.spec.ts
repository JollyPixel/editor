// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import { browse } from "#src/search/browse.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const brush = commands.registerNamespace("brush", { description: "Voxel brush" });
  brush.registerVariable("ghost", {
    type: "boolean",
    description: "Show the ghost block",
    get: () => true,
    set: () => undefined
  });
  brush.registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => 1,
    set: () => undefined
  });
  commands.registerNamespace("audio", { description: "Sound" });
  commands.registerVariable("theme", {
    type: "enum",
    enumValues: ["dark", "light"],
    description: "Colour scheme",
    get: () => "dark",
    set: () => undefined
  });
  commands.registerVariable("grid", {
    type: "boolean",
    description: "Show the grid",
    get: () => false,
    set: () => undefined
  });
  commands.registerCommand("say", {
    description: "Print a line",
    args: [{ name: "text", type: "string", required: true }],
    execute: () => undefined
  });

  return commands;
}

describe("browse", () => {
  const { registry } = createConsole();

  test("lists sections in order and drops the empty ones", () => {
    const sections = browse(registry, []);

    assert.deepEqual(sections.map((section) => section.kind), [
      "toggles",
      "namespaces",
      "commands",
      "variables"
    ]);
  });

  test("lists namespaces and root entries by name with what picking inserts", () => {
    const [, namespaces, commands, variables] = browse(registry, []);

    assert.deepEqual(namespaces.items.map((item) => [item.label, item.text, item.run]), [
      ["audio", "audio.", false],
      ["brush", "brush.", false]
    ]);
    assert.deepEqual(commands.items.map((item) => [item.label, item.text, item.run]), [
      ["/clear", "/clear", true],
      ["/help", "/help", true],
      ["/revert", "/revert", true],
      ["/say", "/say ", false],
      ["/script", "/script", true]
    ]);
    assert.deepEqual(variables.items.map((item) => item.label), ["theme"]);
  });

  test("toggles every boolean variable to its opposite value", () => {
    const [toggles] = browse(registry, []);

    assert.deepEqual(toggles.items.map((item) => [item.label, item.checked, item.text, item.run]), [
      ["brush.ghost", true, "brush.ghost false", true],
      ["grid", false, "grid true", true]
    ]);
  });

  test("skips a boolean variable whose getter throws", () => {
    const commands = new CommandConsole();
    commands.registerVariable("broken", {
      type: "boolean",
      description: "",
      get: () => {
        throw new Error("not ready");
      },
      set: () => undefined
    });

    assert.deepEqual(browse(commands.registry, []).map((section) => section.kind), ["commands"]);
  });

  test("puts the last three distinct lines first, newest first, to run again", () => {
    const history = ["/help", "brush.size 2", "grid true", "brush.size 2", "/clear"];
    const [recent] = browse(registry, history);

    assert.equal(recent.kind, "recent");
    assert.deepEqual(recent.items.map((item) => [item.label, item.run]), [
      ["/clear", true],
      ["brush.size 2", true],
      ["grid true", true]
    ]);
  });
});
