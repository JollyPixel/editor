// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import {
  completionSuggestions,
  inlineCompletion,
  NO_SUGGESTIONS,
  searchSuggestions
} from "#src/element/suggestions.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const git = commands.registerNamespace("git");
  git.registerVariable("autoFetch", {
    type: "boolean",
    description: "",
    get: () => true,
    set: () => undefined
  });
  git.registerCommand("checkout", {
    description: "",
    args: [
      { name: "branch", type: "string", required: true, autocomplete: () => ["main", "feature one"] }
    ],
    execute: () => undefined
  });

  return commands;
}

async function completed(
  input: string,
  highlight = -1
): Promise<string> {
  const { registry } = createConsole();
  const list = await completionSuggestions(input, input.length, registry);

  return inlineCompletion(input, list, highlight);
}

describe("inlineCompletion", () => {
  test("continues the typed command with the first completion", async() => {
    assert.equal(await completed("/git.ch"), "eckout");
    assert.equal(await completed("/git.checkout "), "main");
  });

  test("follows the highlighted suggestion", async() => {
    assert.equal(await completed("/git.checkout ", 1), "\"feature one\"");
  });

  test("ignores case in the typed text", async() => {
    assert.equal(await completed("/GIT.CH"), "eckout");
  });

  test("continues the preselected search result", () => {
    const { registry } = createConsole();
    const list = searchSuggestions("git.auto", registry);

    assert.equal(inlineCompletion("git.auto", list, 0), "Fetch");
  });

  test("is empty when the suggestion does not extend the input", async() => {
    assert.equal(await completed("/git.chekout"), "");
    assert.equal(await completed("/git.checkout f"), "");
    assert.equal(inlineCompletion("git", NO_SUGGESTIONS, -1), "");
  });

  test("is empty once the input is complete", async() => {
    assert.equal(await completed("/git.checkout"), "");
  });
});
