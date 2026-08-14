// Import Node.js Dependencies
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import { AssetRecord } from "@jolly-pixel/asset";

const kBrowserWindow = new Window();

let LoadingClass: typeof import("@jolly-pixel/ui/feedback").Loading;
let RuntimeLoadingScreenClass:
  typeof import("../src/ui/RuntimeLoadingScreen.ts").RuntimeLoadingScreen;

before(async() => {
  installBrowserGlobals();

  ({ Loading: LoadingClass } = await import("@jolly-pixel/ui/feedback"));
  ({ RuntimeLoadingScreen: RuntimeLoadingScreenClass } = await import(
    "../src/ui/RuntimeLoadingScreen.ts"
  ));
});

describe("RuntimeLoadingScreen", () => {
  test("mounts one loading component and hides the canvas", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");

    RuntimeLoadingScreenClass.mount(
      canvas,
      container
    );

    assert.strictEqual(canvas.style.opacity, "0");
    assert.strictEqual(canvas.style.transition, "opacity 0.5s ease-in");
    assert.ok(container.firstElementChild instanceof LoadingClass);
  });

  test("reuses a loading component already mounted in the container", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const loading = document.createElement("jolly-loading");
    container.appendChild(loading);

    const screen = RuntimeLoadingScreenClass.mount(
      canvas,
      container
    );
    screen.setProgress(2, 5);
    screen.error(new Error("load failed"));

    assert.strictEqual(container.childElementCount, 1);
    assert.ok(loading instanceof LoadingClass);
    assert.strictEqual(loading.progress, 2);
    assert.strictEqual(loading.maxProgress, 5);
    assert.strictEqual(loading.errorMessage, "load failed");
  });

  test("forwards asset progress as display state", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const screen = RuntimeLoadingScreenClass.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof LoadingClass);

    screen.update({
      status: "ready",
      completed: 3,
      total: 7,
      record: AssetRecord.parse({
        id: "texture:world",
        kind: "texture",
        source: "textures/world-atlas.png"
      })
    });

    assert.strictEqual(loading.assetName, "textures/world-atlas.png");
    assert.strictEqual(loading.progress, 3);
    assert.strictEqual(loading.maxProgress, 7);
  });

  test("shows the cause stack for a fatal error", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const screen = RuntimeLoadingScreenClass.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof LoadingClass);
    const cause = new Error("decoder failed");

    screen.error(new Error("load failed", { cause }));

    assert.strictEqual(loading.errorMessage, "load failed");
    assert.strictEqual(loading.errorStack, cause.stack);
  });

  test("fills progress before completing an empty load", async() => {
    const originalSetTimeout = window.setTimeout;
    Object.defineProperty(window, "setTimeout", {
      configurable: true,
      value(handler: TimerHandler): number {
        if (typeof handler === "function") {
          handler();
        }

        return 0;
      }
    });
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const screen = RuntimeLoadingScreenClass.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof LoadingClass);

    try {
      screen.setProgress(0, 0);
      const completion = screen.complete();

      assert.strictEqual(loading.progress, 1);
      assert.strictEqual(loading.maxProgress, 1);
      assert.strictEqual(loading.getProgressPercentage(), 100);

      await completion;
    }
    finally {
      container.remove();
      Object.defineProperty(window, "setTimeout", {
        configurable: true,
        value: originalSetTimeout
      });
    }
  });
});

function installBrowserGlobals(): void {
  Object.defineProperties(globalThis, {
    window: {
      configurable: true,
      value: kBrowserWindow
    },
    document: {
      configurable: true,
      value: kBrowserWindow.document
    },
    customElements: {
      configurable: true,
      value: kBrowserWindow.customElements
    },
    HTMLElement: {
      configurable: true,
      value: kBrowserWindow.HTMLElement
    },
    Element: {
      configurable: true,
      value: kBrowserWindow.Element
    },
    Document: {
      configurable: true,
      value: kBrowserWindow.Document
    },
    CSSStyleSheet: {
      configurable: true,
      value: kBrowserWindow.CSSStyleSheet
    },
    ShadowRoot: {
      configurable: true,
      value: kBrowserWindow.ShadowRoot
    },
    requestAnimationFrame: {
      configurable: true,
      value: kBrowserWindow.requestAnimationFrame.bind(kBrowserWindow)
    }
  });
}
