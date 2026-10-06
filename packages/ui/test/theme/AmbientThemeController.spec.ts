// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { AmbientThemeController } from "../../src/theme/AmbientThemeController.ts";

function controllerHost(): ReactiveControllerHost & HTMLElement {
  const element = document.createElement("div");

  return Object.assign(element, {
    addController: () => undefined
  }) as unknown as ReactiveControllerHost & HTMLElement;
}

async function nextFrame(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function pickTheme(
  scope: HTMLElement,
  theme: "light" | "dark"
): void {
  scope.style.colorScheme = theme;
  scope.setAttribute("theme", theme);
}

test("AmbientThemeController follows the page theme until stopped", async() => {
  const scope = document.createElement("jolly-scope");
  pickTheme(scope, "dark");
  const host = controllerHost();
  document.body.append(scope, host);
  const controller = new AmbientThemeController(host);

  controller.follow();
  assert.equal(host.getAttribute("theme"), "dark");

  pickTheme(scope, "light");
  await nextFrame();
  assert.equal(host.getAttribute("theme"), "light");

  controller.stop();
  pickTheme(scope, "dark");
  await nextFrame();
  assert.equal(host.getAttribute("theme"), "light");

  scope.remove();
  host.remove();
});
