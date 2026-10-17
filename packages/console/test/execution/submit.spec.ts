// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";

function lines(
  commands: CommandConsole
): string[] {
  return commands.scrollback.map((entry) => `${entry.kind}: ${entry.text}`);
}

function withBrush(): { commands: CommandConsole; brush: { size: number; }; } {
  const commands = new CommandConsole();
  const brush = { size: 1 };
  commands.registerNamespace("brush").registerVariable("size", {
    type: "number",
    description: "Brush size",
    get: () => brush.size,
    set: (value) => {
      brush.size = Math.min(Math.max(value, 1), 16);
    }
  });

  return {
    commands,
    brush
  };
}

describe("variables", () => {
  test("a read prints the value", async() => {
    const { commands } = withBrush();

    await commands.submit("brush.size");

    assert.deepEqual(lines(commands), ["echo: brush.size", "info: 1"]);
  });

  test("a write prints the value read back after the setter", async() => {
    const { commands, brush } = withBrush();

    await commands.submit("brush.size 999");

    assert.equal(brush.size, 16);
    assert.deepEqual(lines(commands), ["echo: brush.size 999", "info: 16"]);
  });

  test("a literal that does not coerce leaves the variable untouched", async() => {
    const { commands, brush } = withBrush();

    await commands.submit("brush.size big");

    assert.equal(brush.size, 1);
    assert.deepEqual(lines(commands), [
      "echo: brush.size big",
      "error: Expected a number, got \"big\""
    ]);
  });

  test("a setter returning false or throwing becomes an error entry", async() => {
    const commands = new CommandConsole();
    commands.registerVariable("name", {
      type: "string",
      description: "",
      get: () => "a",
      set: (value) => {
        if (value === "taken") {
          throw new Error("\"taken\" is already bound to undo");
        }

        return false;
      }
    });

    await commands.submit("name other");
    await commands.submit("name taken");

    assert.deepEqual(lines(commands), [
      "echo: name other",
      "error: name rejected \"other\"",
      "echo: name taken",
      "error: \"taken\" is already bound to undo"
    ]);
  });

  test("an async setter keeps the echo pending and reads back once it settles", async() => {
    let name = "a";
    const write = Promise.withResolvers<false | undefined>();
    const commands = new CommandConsole();
    commands.registerVariable("name", {
      type: "string",
      description: "",
      get: () => name,
      set: (value) => write.promise.then((result) => {
        name = value;

        return result;
      })
    });

    const submitted = commands.submit("name b");
    await Promise.resolve();
    assert.equal(commands.scrollback[0].pending, true);
    write.resolve(undefined);
    await submitted;

    assert.equal(commands.scrollback[0].pending, false);
    assert.deepEqual(lines(commands), ["echo: name b", "info: b"]);
  });

  test("a value with spaces must be quoted", async() => {
    const values: string[] = [];
    const commands = new CommandConsole();
    commands.registerVariable("redo", {
      type: "string",
      description: "",
      get: () => values.at(-1) ?? "",
      set: (value) => {
        values.push(value);
      }
    });

    await commands.submit("redo mod+y, mod+shift+z");
    await commands.submit("redo \"mod+y, mod+shift+z\"");

    assert.deepEqual(values, ["mod+y, mod+shift+z"]);
    assert.equal(commands.scrollback[1].kind, "error");
  });

  test("an enum write is passed in its declared case", async() => {
    let mode = "add";
    const commands = new CommandConsole();
    commands.registerVariable("mode", {
      type: "enum",
      description: "",
      enumValues: ["add", "rotateY"],
      get: () => mode,
      set: (value) => {
        mode = value;
      }
    });

    await commands.submit("mode ROTATEY");

    assert.equal(mode, "rotateY");
  });

  test("a list takes every value as one item and prints them back", async() => {
    let tags: string[] = ["a"];
    const commands = new CommandConsole();
    commands.registerVariable("tags", {
      type: "string[]",
      description: "",
      get: () => tags,
      set: (value) => {
        tags = value;
      }
    });

    await commands.submit("tags \"two words\" b");
    await commands.submit("tags \"\"");

    assert.deepEqual(tags, []);
    assert.deepEqual(lines(commands), [
      "echo: tags \"two words\" b",
      "info: \"two words\" b",
      "echo: tags \"\"",
      "info: \"\""
    ]);
  });

  test("a list whose getter returns an empty item cannot be read", async() => {
    const commands = new CommandConsole();
    commands.registerVariable("tags", {
      type: "string[]",
      description: "",
      get: () => ["", "a"],
      set: () => undefined
    });

    await commands.submit("tags");

    assert.deepEqual(lines(commands), [
      "echo: tags",
      "error: tags holds an empty item"
    ]);
  });
});
