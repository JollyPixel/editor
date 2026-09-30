// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CommandConsole } from "#src/index.ts";
import { SuggestionController } from "#src/element/SuggestionController.ts";
import { createControllerHost } from "../helpers/controllerHost.ts";

function createConsole(): CommandConsole {
  const commands = new CommandConsole();
  const git = commands.registerNamespace("git", { description: "Version control" });
  git.registerVariable("autoFetch", {
    type: "boolean",
    description: "Fetch in the background",
    get: () => true,
    set: () => undefined
  });
  git.registerVariable("remote", {
    type: "string",
    description: "Default remote",
    get: () => {
      throw new Error("not ready");
    },
    set: () => undefined
  });
  git.registerCommand("checkout", {
    description: "Switch branches",
    args: [
      { name: "branch", type: "string", required: true, autocomplete: () => ["main", "feature one"] }
    ],
    execute: () => undefined
  });

  return commands;
}

async function suggest(
  text: string,
  caret = text.length
): Promise<SuggestionController> {
  const suggestions = new SuggestionController(createControllerHost(), {
    listbox: () => null,
    pick: () => undefined
  });
  await suggestions.refresh(createConsole(), text, caret);

  return suggestions;
}

describe("SuggestionController", () => {
  describe("inlineCompletion", () => {
    test("continues the typed command with the first completion", async() => {
      assert.equal((await suggest("/git.ch")).inlineCompletion("/git.ch"), "eckout");
      assert.equal((await suggest("/git.checkout ")).inlineCompletion("/git.checkout "), "main");
    });

    test("follows the highlighted suggestion", async() => {
      const suggestions = await suggest("/git.checkout ");
      suggestions.move(1);
      suggestions.move(1);

      assert.equal(suggestions.inlineCompletion("/git.checkout "), "\"feature one\"");
    });

    test("ignores case in the typed text", async() => {
      assert.equal((await suggest("/GIT.CH")).inlineCompletion("/GIT.CH"), "eckout");
    });

    test("continues the preselected search result", async() => {
      assert.equal((await suggest("git.auto")).inlineCompletion("git.auto"), "Fetch");
    });

    test("is empty when the suggestion does not extend the input", async() => {
      assert.equal((await suggest("/git.chekout")).inlineCompletion("/git.chekout"), "");
      assert.equal((await suggest("/git.checkout f")).inlineCompletion("/git.checkout f"), "");
    });

    test("is empty once the input is complete", async() => {
      assert.equal((await suggest("/git.checkout")).inlineCompletion("/git.checkout"), "");
    });

    test("is empty over the browse panel", async() => {
      const suggestions = await suggest("");
      assert.notEqual(suggestions.items.length, 0);
      assert.equal(suggestions.inlineCompletion(""), "");

      suggestions.move(1);
      assert.equal(suggestions.inlineCompletion(""), "");
    });
  });

  describe("highlight", () => {
    test("search results start on the first item and wrap around", async() => {
      const suggestions = await suggest("git");
      const count = suggestions.items.length;
      assert.equal(suggestions.highlight, 0);

      suggestions.move(-1);
      assert.equal(suggestions.highlight, count - 1);
      suggestions.move(1);
      assert.equal(suggestions.highlight, 0);
    });

    test("completions start on the prompt, clamp at the end and return above the first", async() => {
      const suggestions = await suggest("/git.checkout ");
      assert.equal(suggestions.highlight, -1);

      suggestions.move(1);
      suggestions.move(1);
      suggestions.move(1);
      assert.equal(suggestions.highlight, 1);

      suggestions.move(-1);
      suggestions.move(-1);
      suggestions.move(-1);
      assert.equal(suggestions.highlight, -1);
    });

    test("an empty list highlights nothing", async() => {
      const suggestions = await suggest("zzzz");
      suggestions.move(1);

      assert.equal(suggestions.items.length, 0);
      assert.equal(suggestions.highlight, -1);
    });
  });

  test("a completion that resolves after a newer refresh is dropped", async() => {
    const commands = createConsole();
    const suggestions = new SuggestionController(createControllerHost(), {
      listbox: () => null,
      pick: () => undefined
    });

    const older = suggestions.refresh(commands, "/git.checkout ", 14);
    await suggestions.refresh(commands, "/git.ch", 7);
    await older;

    assert.deepEqual(suggestions.items.map((item) => item.label), ["/git.checkout"]);
  });

  describe("usage", () => {
    async function usageOf(
      text: string
    ) {
      return (await suggest(text)).usage;
    }

    test("is empty with nothing highlighted", async() => {
      assert.equal(await usageOf(""), null);
    });

    test("shows a command signature", async() => {
      assert.deepEqual(await usageOf("?checkout"), {
        usage: "/git.checkout <branch>",
        description: "Switch branches"
      });
    });

    test("shows a variable type and current value", async() => {
      assert.deepEqual(await usageOf("?autofetch"), {
        usage: "git.autoFetch <boolean> = true",
        description: "Fetch in the background"
      });
    });

    test("leaves the value out when the getter throws", async() => {
      assert.equal((await usageOf("?remote"))?.usage, "git.remote <string>");
    });

    test("counts the members of a namespace", async() => {
      assert.deepEqual(await usageOf("?git"), {
        usage: "git.",
        description: "Version control: 1 command, 2 variables"
      });
    });
  });
});
