// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  Runtime,
  type RuntimeOptions
} from "../src/Runtime.ts";
import { FakeRenderer } from "./helpers/FakeRenderer.ts";

Object.defineProperty(globalThis.navigator, "getGamepads", {
  configurable: true,
  value: () => []
});

function createRuntime(
  options: RuntimeOptions = {}
) {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.append(canvas);
  document.body.append(container);

  const renderer = new FakeRenderer(canvas);
  const runtime: Runtime = Reflect.construct(Runtime, [
    canvas,
    renderer,
    new AssetCatalog([]),
    {
      renderOnDemand: true,
      audio: {},
      ...options
    }
  ]);
  let now = 0;

  return {
    runtime,
    renderer,
    tick(
      count = 1,
      step = 16
    ): void {
      for (let index = 0; index < count; index++) {
        now += step;
        renderer.source.tick(now);
      }
    },
    skip(
      ms: number
    ): void {
      now += ms;
    },
    dispose(): void {
      runtime.dispose();
      container.remove();
    }
  };
}

describe("Runtime renderOnDemand", () => {
  test("stays continuous unless enabled", () => {
    const { runtime, renderer, tick, dispose } = createRuntime({
      renderOnDemand: false
    });
    runtime.start();
    tick(10);
    runtime.world.invalidate();

    assert.equal(runtime.renderOnDemand, false);
    assert.equal(runtime.idle, false);
    assert.equal(renderer.source.looping, true);
    assert.equal(renderer.draws, 10);
    dispose();
  });

  test("goes idle after the first frame and its trailing frames", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    runtime.start();

    tick(10);

    assert.equal(runtime.idle, true);
    assert.equal(runtime.loop.running, true);
    assert.equal(renderer.source.looping, false);
    assert.equal(renderer.draws, 3);
    dispose();
  });

  test("wakes on DOM input anywhere in the page", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    runtime.start();
    tick(10);

    document.body.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true })
    );

    assert.equal(runtime.idle, false);
    assert.equal(renderer.source.looping, true);
    dispose();
  });

  test("stays awake while the pointer hovers the canvas", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    runtime.start();
    tick(10);

    runtime.canvas.dispatchEvent(new MouseEvent("mouseenter"));
    runtime.canvas.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true })
    );
    tick(50);
    assert.equal(runtime.idle, false);
    assert.equal(renderer.source.looping, true);

    runtime.canvas.dispatchEvent(new MouseEvent("mouseleave"));
    tick(10);
    assert.equal(runtime.idle, true);
    dispose();
  });

  test("stops listening for input once stopped", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    runtime.start();
    tick(10);
    runtime.stop();

    document.dispatchEvent(new KeyboardEvent("keydown"));

    assert.equal(renderer.source.looping, false);
    dispose();
  });

  test("the first frame after a wake carries no idle time", () => {
    const { runtime, tick, skip, dispose } = createRuntime();
    const deltas: number[] = [];
    runtime.start();
    tick(10);
    runtime.world.on("beforeUpdate", (dt) => deltas.push(dt));

    skip(60_000);
    runtime.world.invalidate();
    tick();

    assert.deepEqual(deltas, [0]);
    dispose();
  });

  test("nextFrame() wakes an idle runtime", async() => {
    const { runtime, tick, dispose } = createRuntime();
    runtime.start();
    tick(10);

    const frame = runtime.nextFrame();
    tick();
    await frame;

    assert.equal(runtime.idle, false);
    dispose();
  });

  test("world.keepAlive() renders until its predicate turns false", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    let animating = true;
    runtime.start();
    runtime.world.keepAlive(() => animating);

    tick(50);
    assert.equal(renderer.draws, 50);

    animating = false;
    tick(50);
    assert.equal(runtime.idle, true);
    dispose();
  });

  test("a capped runtime keeps running until the owed frames render", () => {
    const { runtime, renderer, tick, dispose } = createRuntime();
    runtime.loop.scheduler.maxFps = 10;
    runtime.start();
    tick(1, 4);
    const draws = renderer.draws;

    runtime.world.invalidate();
    tick(10, 4);
    assert.equal(runtime.idle, false);
    assert.equal(renderer.draws, draws);

    tick(100, 4);
    assert.equal(renderer.draws, draws + 3);
    assert.equal(runtime.idle, true);
    dispose();
  });
});
