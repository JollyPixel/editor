// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import { AnimationDocument } from "#src/model/AnimationDocument.ts";
import { animationHistoryKeys } from "#src/model/animationHistoryKeys.ts";
import {
  key,
  networkCommand
} from "../helpers/clips.ts";

function setup() {
  const document = new AnimationDocument();
  document.addClip({ id: "walk", name: "Walk" });
  document.addClip({ id: "run", name: "Run" });
  const history = new CommandHistory({ scopes: ["animate"] });
  history.register({
    id: "set:humanoid",
    document,
    keys: animationHistoryKeys(document.set),
    scopeOf: () => "animate"
  });

  return { document, history };
}

describe("animationHistoryKeys", () => {
  test("a peer key on the same frame refuses the step, one on another frame does not", () => {
    const { document, history } = setup();

    document.setKey("walk", "Body/Arm", "position", key(0, 1));
    document.apply(networkCommand({
      action: "key-set", clipId: "walk", path: "body/arm", channel: "position", key: key(12, 5)
    }));
    assert.equal(history.state("animate").canUndo, true);

    document.apply(networkCommand({
      action: "key-set", clipId: "walk", path: "BODY/ARM", channel: "position", key: key(0, 9)
    }, { clientId: "peer" }), "peer");
    assert.deepEqual(history.state("animate").refused.map(({ refused }) => refused), [
      { reason: "peer", clientId: "peer" }
    ]);
  });

  test("a peer key inside a new clip refuses undoing the clip's creation", () => {
    const { document, history } = setup();

    document.addClip({ id: "jump", name: "Jump" });
    document.apply(networkCommand({
      action: "key-set", clipId: "jump", path: "Body", channel: "scale", key: key(0, 2)
    }));

    assert.equal(history.state("animate").canUndo, false);
  });

  test("undoing a clip removal re-adds it last when its old neighbour is gone", () => {
    const { document, history } = setup();

    document.removeClip("walk");
    document.apply(networkCommand({ action: "clip-removed", id: "run" }));

    assert.equal(history.undo("animate"), true);
    assert.deepEqual([...document.set.clips()].map(({ id }) => id), ["walk"]);
  });
});
