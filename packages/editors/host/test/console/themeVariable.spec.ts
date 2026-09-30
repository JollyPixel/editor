// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import { registerThemeVariable } from "#src/console/themeVariable.ts";

function scopes(
  count: number
): HTMLElement[] {
  return Array.from({ length: count }, () => {
    const scope = document.createElement("jolly-scope");
    document.body.append(scope);

    return scope;
  });
}

function lastLine(
  commands: CommandConsole
): string {
  const entry = commands.scrollback.at(-1);

  return `${entry?.kind}: ${entry?.text}`;
}

describe("theme variable", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("reads auto while the first scope sets no theme", async() => {
    scopes(1);
    const commands = new CommandConsole();
    registerThemeVariable(commands);

    await commands.submit("theme");

    assert.equal(lastLine(commands), "info: auto");
  });

  test("a write themes every scope of the page", async() => {
    const [first, second] = scopes(2);
    const commands = new CommandConsole();
    registerThemeVariable(commands);

    await commands.submit("theme Light");

    assert.equal(lastLine(commands), "info: light");
    assert.equal(first.getAttribute("theme"), "light");
    assert.equal(second.getAttribute("theme"), "light");
  });

  test("auto removes the theme so the scopes follow the system", async() => {
    const [scope] = scopes(1);
    scope.setAttribute("theme", "dark");
    const commands = new CommandConsole();
    registerThemeVariable(commands);

    await commands.submit("theme auto");

    assert.equal(scope.hasAttribute("theme"), false);
    assert.equal(lastLine(commands), "info: auto");
  });

  test("a write on a page without scope prints an error", async() => {
    const commands = new CommandConsole();
    registerThemeVariable(commands);

    await commands.submit("theme dark");

    assert.equal(
      lastLine(commands),
      "error: This page has no jolly-scope to theme"
    );
  });
});
