// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { animationLiveView } from "#src/features/animation/session/animationLive.ts";
import { AnimationPoser } from "#src/features/animation/session/AnimationPoser.ts";
import { createAnimatedModel } from "./fixtures.ts";

describe("animationLiveView", () => {
  test("names the shown clip and places a block where that clip poses it", () => {
    const model = createAnimatedModel();
    const poser = new AnimationPoser({
      document: model.document,
      blocks: { applyTransform: () => undefined },
      session: model.animationSession,
      requestFrame: () => undefined
    });
    const view = animationLiveView(model.animationSession, poser);
    const { arm } = model.ids;
    assert.equal(view.key(), null);
    assert.equal(view.shownTransform(arm)?.position.x, 1);

    model.tab.activate("animate");
    model.animationSession.seek(24000);

    assert.equal(view.key(), `clip:walk:${model.clipId}`);
    assert.equal(view.shownTransform(arm)?.position.x, 3);
    poser.dispose();
  });
});
