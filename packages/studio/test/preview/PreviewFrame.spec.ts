// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";

// Import Internal Dependencies
import { PreviewFrame } from "../../src/preview/PreviewFrame.ts";

interface HeldPreviewFrame extends Disposable {
  readonly container: HTMLElement;
  readonly editorsIdle: PromiseWithResolvers<void>;
}

function heldPreviewFrame(
  context: TestContext
): HeldPreviewFrame {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const container = document.createElement("div");
  const editorsIdle = Promise.withResolvers<void>();
  const previews = new PreviewFrame({
    url: "about:blank",
    share: {
      serve: () => () => undefined
    },
    identity: () => null,
    onRefused: () => undefined,
    container,
    editorsIdle: () => editorsIdle.promise
  });
  void previews.preview("map").catch(() => undefined);

  return {
    container,
    editorsIdle,
    [Symbol.dispose]() {
      previews.dispose();
    }
  };
}

describe("PreviewFrame", () => {
  test("starts its frame once the selection settles and editors are idle", async(context) => {
    using held = heldPreviewFrame(context);

    context.mock.timers.tick(400);
    await settle();
    assert.equal(held.container.childElementCount, 0);

    held.editorsIdle.resolve();
    await settle();
    assert.equal(held.container.childElementCount, 1);
  });

  test("starts its frame after 5 s when an editor never reports ready", async(context) => {
    using held = heldPreviewFrame(context);

    context.mock.timers.tick(400);
    await settle();
    context.mock.timers.tick(4_999);
    await settle();
    assert.equal(held.container.childElementCount, 0);

    context.mock.timers.tick(1);
    await settle();
    assert.equal(held.container.childElementCount, 1);
  });
});
