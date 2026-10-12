// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { AmbientThemeController } from "../../src/theme/AmbientThemeController.ts";
import {
  clearTheme,
  nextFrame,
  pickTheme
} from "../helpers/theme/scope.ts";

function controllerHost(): ReactiveControllerHost & HTMLElement {
  const element = document.createElement("div");

  return Object.assign(element, {
    addController: () => undefined
  }) as unknown as ReactiveControllerHost & HTMLElement;
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

test("AmbientThemeController hands each new theme to onChange, leaving the attribute", async() => {
  const scope = document.createElement("jolly-scope");
  pickTheme(scope, "dark");
  const host = controllerHost();
  host.setAttribute("theme", "auto");
  document.body.append(scope, host);
  const received: Array<string> = [];
  const controller = new AmbientThemeController(host, {
    onChange: (mode) => received.push(mode)
  });

  controller.follow();
  pickTheme(scope, "dark");
  await nextFrame();
  clearTheme(scope);
  await nextFrame();
  pickTheme(scope, "light");
  await nextFrame();

  assert.deepEqual(received, ["dark", "light"]);
  assert.equal(host.getAttribute("theme"), "auto");

  controller.stop();
  scope.remove();
  host.remove();
});
