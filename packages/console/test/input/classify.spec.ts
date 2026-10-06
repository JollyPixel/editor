// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import { classify } from "#src/input/classify.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  commands.registerVariable("fps", {
    type: "number",
    description: "Frame cap",
    get: () => 60,
    set: () => undefined
  });
  const brush = commands.registerNamespace("brush");
  brush.registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => 1,
    set: () => undefined
  });
  brush.registerCommand("grow", {
    description: "Grow",
    args: [],
    execute: () => undefined
  });

  return commands;
}

describe("classify", () => {
  const { registry } = createConsole();

  const modes: [string, string][] = [
    ["", "search"],
    ["/", "command"],
    ["/brush.grow 2", "command"],
    ["/unknown", "command"],
    ["  /clear", "command"],
    ["brush.size", "variable"],
    ["BRUSH.SIZE 3", "variable"],
    ["brush.size ", "variable"],
    ["brush.si", "search"],
    ["brush", "search"],
    ["brush.grow", "search"],
    ["fps", "variable"],
    ["?fps", "search"],
    ["\"fps\"", "search"],
    ["size", "search"]
  ];
  for (const [input, mode] of modes) {
    test(`${JSON.stringify(input)} is ${mode} mode`, () => {
      assert.equal(classify(input, registry).mode, mode);
    });
  }

  test("a leading ? forces search and strips the prefix", () => {
    assert.deepEqual(classify(" ?fps ", registry), {
      mode: "search",
      query: "fps"
    });
  });

  test("command mode resolves the command or reports none", () => {
    const known = classify("/Brush.Grow 2", registry);
    const unknown = classify("/brush.shrink", registry);

    assert.equal(known.mode === "command" && known.command?.address, "brush.grow");
    assert.equal(unknown.mode === "command" && unknown.command, undefined);
  });

  test("variable mode carries the resolved variable", () => {
    const input = classify("brush.size 3", registry);

    assert.equal(input.mode === "variable" && input.variable.address, "brush.size");
  });
});
