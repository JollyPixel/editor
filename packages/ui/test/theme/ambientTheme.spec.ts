// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import {
  adoptAmbientTheme,
  ambientThemeMode,
  documentThemeMode
} from "../../src/theme/ambientTheme.ts";

function themedParent(
  colorScheme: string
): HTMLElement {
  const parent = document.createElement("div");
  parent.style.setProperty("--jolly-surface", "#123456");
  parent.style.colorScheme = colorScheme;
  document.body.append(parent);

  return parent;
}

test("ambientThemeMode adopts the scheme of a themed parent", () => {
  const parent = themedParent("dark");
  const element = document.createElement("div");
  parent.append(element);

  assert.equal(ambientThemeMode(element), "dark");

  parent.remove();
});

test("ambientThemeMode reads through the shadow root an element renders into", () => {
  const host = themedParent("light");
  const root = host.attachShadow({ mode: "open" });
  const element = document.createElement("div");
  root.append(element);

  assert.equal(ambientThemeMode(element), "light");

  host.remove();
});

test("ambientThemeMode leaves a page that picked no side on auto", () => {
  const parent = themedParent("light dark");
  const element = document.createElement("div");
  parent.append(element);

  assert.equal(ambientThemeMode(element), null);

  parent.remove();
});

test("ambientThemeMode falls back to the page's scope host", () => {
  const scope = document.createElement("jolly-scope");
  scope.style.colorScheme = "dark";
  document.body.append(scope);

  const detached = document.createElement("div");
  document.body.append(detached);

  assert.equal(ambientThemeMode(detached), "dark");

  scope.remove();
  detached.remove();
});

test("documentThemeMode skips scope hosts left on both schemes", () => {
  const auto = document.createElement("jolly-scope");
  auto.style.colorScheme = "light dark";
  const explicit = document.createElement("jolly-scope");
  explicit.style.colorScheme = "light";
  document.body.append(auto, explicit);

  assert.equal(documentThemeMode(document), "light");

  auto.remove();
  explicit.remove();
});

test("documentThemeMode returns null when the page declares no scope", () => {
  assert.equal(documentThemeMode(document), null);
});

test("adoptAmbientTheme follows the ambient theme across calls", () => {
  const parent = themedParent("dark");
  const element = document.createElement("div");
  parent.append(element);

  const first = adoptAmbientTheme(element, null);
  parent.style.colorScheme = "light";
  const second = adoptAmbientTheme(element, first);

  assert.equal(first, "dark");
  assert.equal(second, "light");
  assert.equal(element.getAttribute("theme"), "light");

  parent.remove();
});

test("adoptAmbientTheme leaves a theme the author set", () => {
  const parent = themedParent("dark");
  const element = document.createElement("div");
  element.setAttribute("theme", "light");
  parent.append(element);

  assert.equal(adoptAmbientTheme(element, null), null);
  assert.equal(element.getAttribute("theme"), "light");

  parent.remove();
});
