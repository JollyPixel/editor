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
import {
  registerDensityVariable,
  registerThemeVariable
} from "#src/console/appearanceVariables.ts";

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
      "error: This page has no jolly-scope"
    );
  });
});

describe("density variable", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("reads default while the first scope sets no density", async() => {
    scopes(1);
    const commands = new CommandConsole();
    registerDensityVariable(commands);

    await commands.submit("density");

    assert.equal(lastLine(commands), "info: default");
  });

  test("a write resizes every scope of the page", async() => {
    const [first, second] = scopes(2);
    const commands = new CommandConsole();
    registerDensityVariable(commands);

    await commands.submit("density Compact");

    assert.equal(lastLine(commands), "info: compact");
    assert.equal(first.getAttribute("density"), "compact");
    assert.equal(second.getAttribute("density"), "compact");
  });

  test("default is written instead of removing the attribute", async() => {
    const [scope] = scopes(1);
    scope.setAttribute("density", "comfortable");
    const commands = new CommandConsole();
    registerDensityVariable(commands);

    await commands.submit("density default");

    assert.equal(scope.getAttribute("density"), "default");
    assert.equal(lastLine(commands), "info: default");
  });

  test("a write on a page without scope prints an error", async() => {
    const commands = new CommandConsole();
    registerDensityVariable(commands);

    await commands.submit("density compact");

    assert.equal(
      lastLine(commands),
      "error: This page has no jolly-scope"
    );
  });
});
