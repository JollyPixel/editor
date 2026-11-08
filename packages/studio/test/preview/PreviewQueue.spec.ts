// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PreviewQueue } from "../../src/preview/PreviewQueue.ts";
import {
  servePreviews,
  type PreviewRenderer
} from "../../src/preview/page/servePreviews.ts";

// CONSTANTS
const kSize = 512;

class FakeRenderer implements PreviewRenderer {
  readonly asked: string[] = [];
  #pending = new Map<string, PromiseWithResolvers<Uint8Array<ArrayBuffer>>>();

  render(
    assetId: string,
    size: number
  ): Promise<Uint8Array<ArrayBuffer>> {
    this.asked.push(`${assetId}:${size}`);
    const pending = Promise.withResolvers<Uint8Array<ArrayBuffer>>();
    this.#pending.set(assetId, pending);

    return pending.promise;
  }

  finish(
    assetId: string,
    ...bytes: number[]
  ): void {
    this.#pending.get(assetId)?.resolve(Uint8Array.from(bytes));
  }

  fail(
    assetId: string,
    reason: string
  ): void {
    this.#pending.get(assetId)?.reject(new Error(reason));
  }
}

function connect(
  options: { timeoutMs?: number; } = {}
) {
  const channel = new MessageChannel();
  const renderer = new FakeRenderer();
  servePreviews(channel.port2, Promise.resolve(renderer));
  const queue = new PreviewQueue({
    port: channel.port1,
    size: () => kSize,
    ...options
  });

  return {
    queue,
    renderer
  };
}

async function deliver(): Promise<void> {
  for (let turn = 0; turn < 4; turn++) {
    await new Promise(setImmediate);
  }
}

describe("PreviewQueue", () => {
  test("renders one asset at a time, in request order, as PNG bytes", async() => {
    const { queue, renderer } = connect();

    const first = queue.preview("model");
    const second = queue.preview("map");
    await deliver();
    assert.deepStrictEqual(renderer.asked, ["model:512"]);

    renderer.finish("model", 1, 2);
    assert.deepStrictEqual(await first, {
      type: "image/png",
      bytes: Uint8Array.from([1, 2])
    });
    await deliver();
    assert.deepStrictEqual(renderer.asked, ["model:512", "map:512"]);
    renderer.finish("map", 3);
    assert.deepStrictEqual((await second).bytes, Uint8Array.from([3]));
    queue.dispose();
  });

  test("rejects a render the frame fails, then serves the next one", async() => {
    const { queue, renderer } = connect();

    const failing = queue.preview("model");
    const next = queue.preview("map");
    await deliver();
    renderer.fail("model", "No scene component shows \"sound\" assets.");

    await assert.rejects(failing, /No scene component shows "sound" assets/);
    await deliver();
    renderer.finish("map", 7);
    assert.deepStrictEqual((await next).bytes, Uint8Array.from([7]));
    queue.dispose();
  });

  test("gives up on a render that times out and ignores its late reply", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { queue, renderer } = connect({ timeoutMs: 1_000 });

    const slow = queue.preview("model");
    const next = queue.preview("map");
    await deliver();
    t.mock.timers.tick(1_000);

    await assert.rejects(slow, /Rendering "model" timed out/);
    renderer.finish("model", 1);
    await deliver();
    renderer.finish("map", 2);
    assert.deepStrictEqual((await next).bytes, Uint8Array.from([2]));
    queue.dispose();
  });

  test("rejects every waiting render when disposed", async() => {
    const { queue } = connect();
    const pending = [queue.preview("model"), queue.preview("map")];

    queue.dispose();

    for (const render of pending) {
      await assert.rejects(render, /The preview frame closed/);
    }
    await assert.rejects(queue.preview("other"), /The preview frame closed/);
  });
});
