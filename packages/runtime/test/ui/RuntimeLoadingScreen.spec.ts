// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRecord } from "@jolly-pixel/asset";
import { Loading } from "@jolly-pixel/ui/feedback";

// Import Internal Dependencies
import { RuntimeLoadingScreen } from "../../src/ui/RuntimeLoadingScreen.ts";

describe("RuntimeLoadingScreen", () => {
  test("mounts one loading component and hides the canvas", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");

    RuntimeLoadingScreen.mount(
      canvas,
      container
    );

    assert.strictEqual(canvas.style.opacity, "0");
    assert.strictEqual(canvas.style.transition, "opacity 0.5s ease-in");
    assert.ok(container.firstElementChild instanceof Loading);
  });

  test("reuses a loading component already mounted in the container", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const loading = document.createElement("jolly-loading");
    container.appendChild(loading);

    const screen = RuntimeLoadingScreen.mount(
      canvas,
      container
    );
    screen.setProgress(2, 5);
    screen.error(new Error("load failed"));

    assert.strictEqual(container.childElementCount, 1);
    assert.ok(loading instanceof Loading);
    assert.strictEqual(loading.progress, 2);
    assert.strictEqual(loading.maxProgress, 5);
    assert.strictEqual(loading.errorMessage, "load failed");
  });

  test("forwards asset progress as display state", () => {
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const screen = RuntimeLoadingScreen.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof Loading);

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
    const screen = RuntimeLoadingScreen.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof Loading);
    const cause = new Error("decoder failed");

    screen.error(new Error("load failed", { cause }));

    assert.strictEqual(loading.errorMessage, "load failed");
    assert.strictEqual(loading.errorStack, cause.stack);
  });

  test("fills progress and reveals the canvas once an empty load completes", async(t) => {
    t.mock.method(window, "setTimeout", (handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return 0;
    });
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    document.body.appendChild(container);
    t.after(() => container.remove());
    const screen = RuntimeLoadingScreen.mount(
      canvas,
      container
    );
    const loading = container.querySelector("jolly-loading");
    assert.ok(loading instanceof Loading);

    screen.setProgress(0, 0);
    const completion = screen.complete();

    assert.strictEqual(loading.progress, 1);
    assert.strictEqual(loading.maxProgress, 1);
    assert.strictEqual(loading.getProgressPercentage(), 100);
    assert.strictEqual(canvas.style.opacity, "0");

    await completion;

    assert.strictEqual(canvas.style.opacity, "1");
    assert.strictEqual(loading.isConnected, false);
  });
});
