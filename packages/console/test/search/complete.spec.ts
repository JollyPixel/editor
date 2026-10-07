// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import { complete } from "#src/search/complete.ts";
import { withNested } from "../helpers/registry/withNested.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const git = commands.registerNamespace("git");
  git.registerVariable("autoFetch", {
    type: "boolean",
    description: "Fetch in the background",
    get: () => true,
    set: () => undefined
  });
  git.registerVariable("remote", {
    type: "string",
    description: "Remote name",
    get: () => "origin",
    set: () => undefined
  });
  git.registerCommand("checkout", {
    description: "Switch branch",
    args: [
      { name: "branch", type: "string", required: true, autocomplete: () => ["main", "feature one"] },
      { name: "mode", type: "enum", enumValues: ["soft", "hard"] }
    ],
    execute: () => undefined
  });
  commands.registerCommand("say", {
    description: "",
    args: [{ name: "text", type: "string", rest: true, autocomplete: () => ["hello world"] }],
    execute: () => undefined
  });

  return commands;
}

async function lines(
  input: string,
  caret = input.length
): Promise<string[]> {
  const list = await complete(input, caret, createConsole().registry);

  return list.items.map((item) => item.text);
}

describe("complete", () => {
  test("after / lists root and namespaced commands", async() => {
    assert.deepEqual(
      await lines("/"),
      ["/cd", "/clear", "/git.checkout", "/help", "/revert", "/say", "/script"]
    );
    assert.deepEqual(await lines("/g"), ["/git.checkout"]);
  });

  test("after /namespace. lists that namespace's commands only", async() => {
    assert.deepEqual(await lines("/git."), ["/git.checkout"]);
    assert.deepEqual(await lines("/nope."), []);
  });

  test("a variable address completes to its declared case", async() => {
    const { registry } = createConsole();
    const list = await complete("git.autofetch", 13, registry);

    assert.deepEqual(list.items.map((item) => [item.text, item.caret, item.run]), [
      ["git.autoFetch", 13, false]
    ]);
  });

  test("a boolean variable offers true and false with the current value as hint", async() => {
    const { registry } = createConsole();
    const list = await complete("git.autoFetch ", 14, registry);

    assert.deepEqual(list.items.map((item) => item.label), ["true", "false"]);
    assert.equal(list.hint, "true");
  });

  test("a string variable offers no values and hints the current value", async() => {
    const list = await complete("git.remote ", 11, createConsole().registry);

    assert.deepEqual(list.items, []);
    assert.equal(list.hint, "origin");
  });

  test("a boolean list offers true and false at every item, hinting its items", async() => {
    const commands = new CommandConsole();
    commands.registerVariable("flags", {
      type: "boolean[]",
      description: "",
      get: () => [true, false],
      set: () => undefined
    });
    commands.registerVariable("name", {
      type: "string",
      description: "",
      get: () => "",
      set: () => undefined
    });

    const list = await complete("flags true f", 12, commands.registry);
    const scalar = await complete("name a ", 7, commands.registry);

    assert.deepEqual(list.items.map((item) => item.label), ["false"]);
    assert.equal(list.hint, "true false");
    assert.equal(scalar.hint, null);
  });

  test("a variable whose getter throws completes without a hint", async() => {
    const commands = new CommandConsole();
    commands.registerVariable("broken", {
      type: "boolean",
      description: "",
      get: () => {
        throw new Error("not ready");
      },
      set: () => undefined
    });

    const list = await complete("broken ", 7, commands.registry);

    assert.deepEqual(list.items.map((item) => item.label), ["true", "false"]);
    assert.equal(list.hint, null);
  });

  test("argument values come from autocomplete, quoted when needed", async() => {
    assert.deepEqual(await lines("/git.checkout "), [
      "/git.checkout main",
      "/git.checkout \"feature one\""
    ]);
    assert.deepEqual(await lines("/git.checkout f"), ["/git.checkout \"feature one\""]);
  });

  test("argument values come from enumValues for the argument under the caret", async() => {
    assert.deepEqual(await lines("/git.checkout main "), [
      "/git.checkout main soft",
      "/git.checkout main hard"
    ]);
    assert.deepEqual(await lines("/git.checkout main h"), ["/git.checkout main hard"]);
    assert.deepEqual(await lines("/git.checkout main hard x"), []);
  });

  test("the caret picks the token, not the end of the line", async() => {
    assert.deepEqual(await lines("/git.checkout ma soft", 16), ["/git.checkout main soft"]);
  });

  test("a rest argument value is inserted unquoted", async() => {
    assert.deepEqual(await lines("/say "), ["/say hello world"]);
  });

  test("the hint of an argument is the command signature", async() => {
    const list = await complete("/git.checkout ", 14, createConsole().registry);

    assert.equal(list.hint, "/git.checkout <branch> [mode:soft|hard]");
  });

  test("search mode completes nothing", async() => {
    assert.deepEqual(await lines("git"), []);
  });

  test("replacing a token keeps the rest of the line and puts the caret after it", async() => {
    const { registry } = createConsole();
    const list = await complete("/git.checkout ma soft", 16, registry);

    assert.deepEqual(list.items.map((item) => [item.text, item.caret]), [
      ["/git.checkout main soft", 18]
    ]);
  });

  test("a mistyped command falls back to the closest addresses", async() => {
    assert.deepEqual(await lines("/git.chekout"), ["/git.checkout"]);
    assert.deepEqual(await lines("/gti.checkout"), ["/git.checkout"]);
  });

  test("a mistyped value falls back to the closest values", async() => {
    assert.deepEqual(await lines("/git.checkout main hsrd"), ["/git.checkout main hard"]);
    assert.deepEqual(await lines("/git.checkout feture"), ["/git.checkout \"feature one\""]);
  });

  test("typos are not offered while a prefix matches", async() => {
    assert.deepEqual(await lines("/git.checkout main s"), ["/git.checkout main soft"]);
  });

  test("a rejecting autocomplete yields an empty list", async() => {
    const commands = new CommandConsole();
    commands.registerCommand("open", {
      description: "",
      args: [{
        name: "file",
        type: "string",
        autocomplete: () => Promise.reject(new Error("offline"))
      }],
      execute: () => undefined
    });

    const list = await complete("/open ", 6, commands.registry);

    assert.deepEqual(list.items, []);
  });
});

describe("complete in nested namespaces", () => {
  async function scopedLines(
    scope: string,
    input: string
  ): Promise<string[]> {
    const { commands } = withNested();
    commands.enter(scope);
    const list = await complete(input, input.length, commands.scoped);

    return list.items.map((item) => item.text);
  }

  test("after /namespace. lists the commands of every namespace nested in it", async() => {
    assert.deepEqual(await scopedLines("", "/pixelart."), ["/pixelart.keybinds.reset"]);
  });

  test("in a scope, lists its commands relative to it before the root ones", async() => {
    assert.deepEqual(await scopedLines("pixelart.keybinds", "/re"), ["/reset", "/revert"]);
    assert.deepEqual(await scopedLines("pixelart", "/keybinds."), ["/keybinds.reset"]);
  });
});
