// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import {
  PageAppearance,
  type Appearance
} from "#src/appearance/PageAppearance.ts";

function scope(
  attributes: Record<string, string> = {}
): HTMLElement {
  const element = document.createElement("jolly-scope");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.append(element);

  return element;
}

describe("PageAppearance", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("reads the first scope, auto and default when unset", () => {
    const appearance = new PageAppearance();
    assert.deepEqual(appearance.toJSON(), {
      theme: "auto",
      density: "default"
    });

    scope({ theme: "light", density: "compact" });
    scope({ theme: "dark" });
    assert.deepEqual(appearance.toJSON(), {
      theme: "light",
      density: "compact"
    });
  });

  test("apply writes every scope and removes the theme for auto", () => {
    const first = scope({ theme: "dark" });
    const second = scope();

    new PageAppearance().apply({
      theme: "auto",
      density: "comfortable"
    });

    for (const element of [first, second]) {
      assert.equal(element.hasAttribute("theme"), false);
      assert.equal(element.getAttribute("density"), "comfortable");
    }
  });

  test("apply on a page without scope changes nothing", () => {
    assert.doesNotThrow(() => new PageAppearance().apply({
      theme: "light",
      density: "compact"
    }));
  });

  test("reads the scopes of the root it was given", () => {
    const root = document.createElement("div");
    root.append(document.createElement("jolly-scope"));
    scope({ theme: "light" });

    const appearance = new PageAppearance(root);
    appearance.theme = "dark";

    assert.equal(appearance.theme, "dark");
    assert.equal(document.body.querySelector("jolly-scope")?.getAttribute("theme"), "light");
  });

  test("watch reports appearance changes of any scope until aborted", async() => {
    const first = scope({ theme: "dark" });
    const received: Appearance[] = [];
    const listening = new AbortController();
    new PageAppearance().watch((appearance) => {
      received.push(appearance);
    }, listening.signal);

    first.setAttribute("theme", "light");
    await setImmediate();
    first.setAttribute("title", "ignored");
    document.body.appendChild(
      document.createElement("div")
    ).setAttribute("theme", "ignored");
    await setImmediate();
    scope().setAttribute("density", "compact");
    await setImmediate();
    listening.abort();
    first.setAttribute("theme", "dark");
    await setImmediate();

    assert.deepEqual(received, [
      { theme: "light", density: "default" },
      { theme: "light", density: "default" }
    ]);
  });
});
