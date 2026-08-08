// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { ThemeMode } from "../../src/index.ts";
import {
  ThemeController,
  type ThemeTarget
} from "../../examples/scripts/demo/ThemeController.ts";

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media = "(prefers-color-scheme: dark)";
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
  matches = false;

  addListener(): void {
    // Deprecated API not used by ThemeController.
  }

  removeListener(): void {
    // Deprecated API not used by ThemeController.
  }
}

function createThemeSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  for (const value of ["auto", "light", "dark"]) {
    const option = document.createElement("option");
    option.value = value;
    select.append(option);
  }
  select.value = "auto";

  return select;
}

describe("ThemeController", () => {
  test("resolves themes and detaches listeners on dispose", () => {
    const mediaQuery = new FakeMediaQueryList();
    window.matchMedia = () => mediaQuery;
    const select = createThemeSelect();
    const target: ThemeTarget = { theme: "auto" };
    const resolved: Exclude<ThemeMode, "auto">[] = [];
    const controller = new ThemeController({
      drawPanel: target,
      select,
      onResolvedThemeChange: (theme) => resolved.push(theme)
    });

    assert.strictEqual(target.theme, "auto");
    assert.strictEqual(document.documentElement.dataset.resolvedTheme, "light");

    select.value = "dark";
    select.dispatchEvent(new Event("change"));
    assert.strictEqual(target.theme, "dark");
    assert.strictEqual(document.documentElement.dataset.resolvedTheme, "dark");

    select.value = "auto";
    select.dispatchEvent(new Event("change"));
    mediaQuery.matches = true;
    mediaQuery.dispatchEvent(new Event("change"));
    assert.strictEqual(document.documentElement.dataset.resolvedTheme, "dark");

    controller.dispose();
    controller.dispose();
    const callCount = resolved.length;
    select.value = "light";
    select.dispatchEvent(new Event("change"));
    assert.strictEqual(resolved.length, callCount);
  });
});
