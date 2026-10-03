// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { CommandConsole } from "@jolly-pixel/console";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  mountConsole,
  type EditorConsole
} from "#src/console/mountConsole.ts";

let mounted: EditorConsole | undefined;

function scopes(
  count: number
): HTMLElement[] {
  return Array.from({ length: count }, () => {
    const scope = document.createElement("jolly-scope");
    document.body.append(scope);

    return scope;
  });
}

function commands(
  storage: StorageAdapter = new MemoryStorageAdapter()
): CommandConsole {
  mounted = mountConsole({ storage });

  return mounted.commands;
}

function lastLine(
  page: CommandConsole
): string {
  const entry = page.scrollback.at(-1);

  return `${entry?.kind}: ${entry?.text}`;
}

afterEach(() => {
  mounted?.dispose();
  mounted = undefined;
  document.body.replaceChildren();
});

describe("theme variable", () => {
  test("reads auto while the first scope sets no theme", async() => {
    scopes(1);
    const page = commands();

    await page.submit("theme");

    assert.equal(lastLine(page), "info: auto");
  });

  test("a write themes every scope of the page", async() => {
    const [first, second] = scopes(2);
    const page = commands();

    await page.submit("theme Light");

    assert.equal(lastLine(page), "info: light");
    assert.equal(first.getAttribute("theme"), "light");
    assert.equal(second.getAttribute("theme"), "light");
  });

  test("auto removes the theme so the scopes follow the system", async() => {
    const [scope] = scopes(1);
    scope.setAttribute("theme", "dark");
    const page = commands();

    await page.submit("theme auto");

    assert.equal(scope.hasAttribute("theme"), false);
    assert.equal(lastLine(page), "info: auto");
  });

  test("a write on a page without scope prints an error", async() => {
    const page = commands();

    await page.submit("theme dark");

    assert.equal(
      lastLine(page),
      "error: This page has no jolly-scope"
    );
  });
});

describe("density variable", () => {
  test("reads default while the first scope sets no density", async() => {
    scopes(1);
    const page = commands();

    await page.submit("density");

    assert.equal(lastLine(page), "info: default");
  });

  test("a write resizes every scope of the page", async() => {
    const [first, second] = scopes(2);
    const page = commands();

    await page.submit("density Compact");

    assert.equal(lastLine(page), "info: compact");
    assert.equal(first.getAttribute("density"), "compact");
    assert.equal(second.getAttribute("density"), "compact");
  });

  test("default is written instead of removing the attribute", async() => {
    const [scope] = scopes(1);
    scope.setAttribute("density", "comfortable");
    const page = commands();

    await page.submit("density default");

    assert.equal(scope.getAttribute("density"), "default");
    assert.equal(lastLine(page), "info: default");
  });

  test("a write on a page without scope prints an error", async() => {
    const page = commands();

    await page.submit("density compact");

    assert.equal(
      lastLine(page),
      "error: This page has no jolly-scope"
    );
  });
});

describe("appearance persistence", () => {
  test("a write is restored by the next console on the storage", async() => {
    const storage = new MemoryStorageAdapter();
    scopes(1);
    const page = commands(storage);
    await page.submit("theme light");
    await page.submit("density compact");
    mounted?.dispose();
    document.body.replaceChildren();

    const [scope] = scopes(1);
    scope.setAttribute("theme", "dark");
    scope.setAttribute("density", "comfortable");
    commands(storage);

    assert.equal(storage.get("jolly-pixel:theme"), "light");
    assert.equal(storage.get("jolly-pixel:density"), "compact");
    assert.equal(scope.getAttribute("theme"), "light");
    assert.equal(scope.getAttribute("density"), "compact");
  });

  test("an invalid stored value keeps the page appearance", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("jolly-pixel:theme", "neon");
    storage.set("jolly-pixel:density", "compact");
    const [scope] = scopes(1);
    scope.setAttribute("theme", "dark");
    scope.setAttribute("density", "comfortable");

    commands(storage);

    assert.equal(scope.getAttribute("theme"), "dark");
    assert.equal(scope.getAttribute("density"), "compact");
  });

  test("a rejected write stores nothing", async() => {
    const storage = new MemoryStorageAdapter();
    const page = commands(storage);

    await page.submit("theme dark");

    assert.equal(storage.get("jolly-pixel:theme"), null);
  });
});
