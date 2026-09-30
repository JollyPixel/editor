// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import {
  applyCompletion,
  complete
} from "#src/search/complete.ts";

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

async function values(
  input: string,
  caret = input.length
): Promise<string[]> {
  const list = await complete(input, caret, createConsole().registry);

  return list.items.map((item) => item.value);
}

describe("complete", () => {
  test("after / lists root and namespaced commands", async() => {
    assert.deepEqual(await values("/"), ["/clear", "/git.checkout", "/help", "/say"]);
    assert.deepEqual(await values("/g"), ["/git.checkout"]);
  });

  test("after /namespace. lists that namespace's commands only", async() => {
    assert.deepEqual(await values("/git."), ["/git.checkout"]);
    assert.deepEqual(await values("/nope."), []);
  });

  test("a variable address completes to its declared case", async() => {
    const { registry } = createConsole();
    const list = await complete("git.autofetch", 13, registry);

    assert.deepEqual(list.items.map((item) => item.value), ["git.autoFetch"]);
    assert.deepEqual(applyCompletion("git.autofetch", list, list.items[0]), {
      text: "git.autoFetch",
      caret: 13
    });
  });

  test("a boolean variable offers true and false with the current value as hint", async() => {
    const { registry } = createConsole();
    const list = await complete("git.autoFetch ", 14, registry);

    assert.deepEqual(list.items.map((item) => item.value), ["true", "false"]);
    assert.equal(list.hint, "true");
  });

  test("a string variable offers no values and hints the current value", async() => {
    const list = await complete("git.remote ", 11, createConsole().registry);

    assert.deepEqual(list.items, []);
    assert.equal(list.hint, "origin");
  });

  test("argument values come from autocomplete, quoted when needed", async() => {
    assert.deepEqual(await values("/git.checkout "), ["main", "\"feature one\""]);
    assert.deepEqual(await values("/git.checkout f"), ["\"feature one\""]);
  });

  test("argument values come from enumValues for the argument under the caret", async() => {
    assert.deepEqual(await values("/git.checkout main "), ["soft", "hard"]);
    assert.deepEqual(await values("/git.checkout main h"), ["hard"]);
    assert.deepEqual(await values("/git.checkout main hard x"), []);
  });

  test("the caret picks the token, not the end of the line", async() => {
    assert.deepEqual(await values("/git.checkout ma soft", 16), ["main"]);
  });

  test("a rest argument value is inserted unquoted", async() => {
    assert.deepEqual(await values("/say "), ["hello world"]);
  });

  test("the hint of an argument is the command signature", async() => {
    const list = await complete("/git.checkout ", 14, createConsole().registry);

    assert.equal(list.hint, "/git.checkout <branch> [mode:soft|hard]");
  });

  test("search mode completes nothing", async() => {
    assert.deepEqual(await values("git"), []);
  });

  test("replacing a token keeps the rest of the line", async() => {
    const { registry } = createConsole();
    const list = await complete("/git.checkout ma soft", 16, registry);

    assert.deepEqual(applyCompletion("/git.checkout ma soft", list, list.items[0]), {
      text: "/git.checkout main soft",
      caret: 18
    });
  });

  test("a mistyped command falls back to the closest addresses", async() => {
    assert.deepEqual(await values("/git.chekout"), ["/git.checkout"]);
    assert.deepEqual(await values("/gti.checkout"), ["/git.checkout"]);
  });

  test("a mistyped value falls back to the closest values", async() => {
    assert.deepEqual(await values("/git.checkout main hsrd"), ["hard"]);
    assert.deepEqual(await values("/git.checkout feture"), ["\"feature one\""]);
  });

  test("typos are not offered while a prefix matches", async() => {
    assert.deepEqual(await values("/git.checkout main s"), ["soft"]);
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
