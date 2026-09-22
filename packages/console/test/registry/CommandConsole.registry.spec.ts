// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ArgumentOrderError,
  CommandConsole,
  DuplicateArgumentError,
  InvalidIdentifierError,
  InvalidRestArgumentError,
  MissingEnumValuesError,
  type ArgDef
} from "#src/index.ts";

function noop(): void {
  // no-op
}

function command(
  args: readonly ArgDef[] = []
) {
  return {
    description: "",
    args,
    execute: noop
  };
}

function numberVariable(
  value = 0
) {
  return {
    type: "number" as const,
    description: "",
    get: () => value,
    set: noop
  };
}

describe("identifiers", () => {
  const valid = ["size", "_private", "auto-fetch", "flipY", "a1_b-2", "Z"];
  const invalid = ["", "1size", "-dash", "brush.size", "with space", "size!", "été"];

  for (const name of valid) {
    test(`accepts "${name}"`, () => {
      const commands = new CommandConsole();

      commands.registerVariable(name, numberVariable());
      commands.registerNamespace(name);

      assert.equal(commands.registry.resolveVariable(name)?.name, name);
      assert.equal(commands.registry.namespace(name)?.name, name);
    });
  }

  for (const name of invalid) {
    test(`rejects "${name}"`, () => {
      const commands = new CommandConsole();

      assert.throws(() => commands.registerNamespace(name), InvalidIdentifierError);
      assert.throws(() => commands.registerCommand(name, command()), InvalidIdentifierError);
      assert.throws(() => commands.registerVariable(name, numberVariable()), InvalidIdentifierError);
      assert.throws(
        () => commands.registerCommand("cmd", command([{ name, type: "string" }])),
        InvalidIdentifierError
      );
    });
  }
});

describe("argument rules", () => {
  test("rejects an optional argument before a required one", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerCommand("cmd", command([
      { name: "a", type: "string" },
      { name: "b", type: "string", required: true }
    ])), ArgumentOrderError);
  });

  test("rejects an enum argument without enumValues", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerCommand("cmd", command([
      // @ts-expect-error an enum argument requires enumValues
      { name: "mode", type: "enum" }
    ])), MissingEnumValuesError);
    assert.throws(() => commands.registerCommand("cmd", command([
      { name: "mode", type: "enum", enumValues: [] }
    ])), MissingEnumValuesError);
  });

  test("rejects an enum variable without enumValues", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerVariable("mode", {
      type: "enum",
      description: "",
      enumValues: [],
      get: () => "",
      set: noop
    }), MissingEnumValuesError);
  });

  test("rejects a rest argument that is not last", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerCommand("cmd", command([
      { name: "text", type: "string", rest: true },
      { name: "other", type: "string" }
    ])), InvalidRestArgumentError);
  });

  test("rejects a rest argument that is not a string", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerCommand("cmd", command([
      // @ts-expect-error only a string argument can be rest
      { name: "count", type: "number", rest: true }
    ])), InvalidRestArgumentError);
  });

  test("rejects two arguments sharing a name", () => {
    const commands = new CommandConsole();

    assert.throws(() => commands.registerCommand("cmd", command([
      { name: "a", type: "string", required: true },
      { name: "a", type: "number" }
    ])), DuplicateArgumentError);
  });

  test("accepts required, then optional, then rest", () => {
    const commands = new CommandConsole();

    commands.registerCommand("say", command([
      { name: "to", type: "string", required: true },
      { name: "tone", type: "enum", enumValues: ["loud", "soft"] },
      { name: "text", type: "string", rest: true }
    ]));

    assert.equal(commands.registry.resolveCommand("say")?.def.args.length, 3);
  });
});

describe("overwrites and handles", () => {
  test("an old handle leaves the registration that replaced it alone", () => {
    const commands = new CommandConsole();
    const brush = commands.registerNamespace("brush");

    const first = brush.registerCommand("grow", command());
    const second = brush.registerCommand("grow", command());
    first.unregister();

    assert.ok(commands.registry.resolveCommand("brush.grow"));

    second.unregister();

    assert.equal(commands.registry.resolveCommand("brush.grow"), undefined);
  });

  test("a variable overwrite replaces the earlier definition", () => {
    const commands = new CommandConsole();

    const first = commands.registerVariable("fps", numberVariable(30));
    commands.registerVariable("fps", numberVariable(60));
    first.unregister();

    assert.equal(commands.registry.resolveVariable("fps")?.def.get(), 60);
  });

  test("re-registering a namespace drops every entry of the old one", () => {
    const commands = new CommandConsole();
    const old = commands.registerNamespace("brush", { description: "old" });
    old.registerCommand("grow", command());
    old.registerVariable("size", numberVariable());

    const fresh = commands.registerNamespace("brush", { description: "new" });

    assert.equal(commands.registry.namespace("brush")?.description, "new");
    assert.equal(commands.registry.resolveCommand("brush.grow"), undefined);
    assert.equal(commands.registry.resolveVariable("brush.size"), undefined);

    old.unregister();
    fresh.registerVariable("size", numberVariable());

    assert.ok(commands.registry.resolveVariable("brush.size"));
  });

  test("unregistering a namespace removes everything under it", () => {
    const commands = new CommandConsole();
    const brush = commands.registerNamespace("brush");
    brush.registerCommand("grow", command());

    brush.unregister();

    assert.equal(commands.registry.namespace("brush"), undefined);
    assert.equal(commands.registry.resolveCommand("brush.grow"), undefined);
  });
});

describe("names", () => {
  test("resolve case-insensitively and keep the declared case", () => {
    const commands = new CommandConsole();
    const git = commands.registerNamespace("Git");
    git.registerVariable("autoFetch", numberVariable());

    const variable = commands.registry.resolveVariable("git.AUTOFETCH");

    assert.equal(variable?.name, "autoFetch");
    assert.equal(variable?.address, "Git.autoFetch");
  });

  test("names differing only in case collide", () => {
    const commands = new CommandConsole();
    commands.registerVariable("fps", numberVariable(30));
    commands.registerVariable("FPS", numberVariable(60));

    const variable = commands.registry.resolveVariable("fps");

    assert.equal(variable?.name, "FPS");
    assert.equal(variable?.def.get(), 60);
  });

  test("a root variable, a root command and a namespace share a name", () => {
    const commands = new CommandConsole();
    commands.registerVariable("git", numberVariable());
    commands.registerCommand("git", command());
    commands.registerNamespace("git").registerCommand("fetch", command());

    assert.equal(commands.registry.resolveVariable("git")?.kind, "variable");
    assert.equal(commands.registry.resolveCommand("git")?.kind, "command");
    assert.equal(commands.registry.resolveCommand("git.fetch")?.address, "git.fetch");
  });

  test("an address with more than one dot resolves to nothing", () => {
    const commands = new CommandConsole();
    commands.registerNamespace("a").registerCommand("b", command());

    assert.equal(commands.registry.resolveCommand("a.b.c"), undefined);
  });
});
