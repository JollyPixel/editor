// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import type {
  SceneChange,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { DraftGesture } from "../../src/features/viewport/DraftGesture.ts";

type DocumentEvents = {
  change: (change: SceneChange) => void;
  reset: () => void;
};

interface Stage {
  gesture: DraftGesture;
  document: Emitter<DocumentEvents>;
  camera: { enabled: boolean; };
  calls: [string, ...unknown[]][];
  interrupts: number;
}

function createStage(): Stage {
  const document = new Emitter<DocumentEvents>();
  const camera = { enabled: true };
  const stage: Stage = {
    document,
    camera,
    calls: [],
    interrupts: 0,
    gesture: new DraftGesture({
      camera,
      document: document as never,
      draft: {
        editTransform: (id, patch) => stage.calls.push(["edit", id, patch]),
        commitTransform: (id, patch) => stage.calls.push(["commit", id, patch]),
        discardTransform: (id) => stage.calls.push(["discard", id])
      },
      onInterrupt: () => {
        stage.interrupts++;
      }
    })
  };

  return stage;
}

function moved(
  x: number
): SceneTransformPatch {
  return {
    position: {
      x,
      y: 0,
      z: 0
    }
  };
}

function transformed(
  origin: string,
  id: string
): SceneChange {
  return {
    origin,
    command: {
      action: "actor-transformed",
      id
    }
  } as never;
}

describe("DraftGesture", () => {
  test("commits the last preview and frees the camera on end", () => {
    const stage = createStage();

    stage.gesture.begin("crate");
    assert.equal(stage.camera.enabled, false);
    stage.gesture.edit(moved(1));
    stage.gesture.edit(moved(2));
    stage.gesture.end();

    assert.deepEqual(stage.calls, [
      ["edit", "crate", moved(1)],
      ["edit", "crate", moved(2)],
      ["commit", "crate", moved(2)]
    ]);
    assert.equal(stage.camera.enabled, true);
    assert.equal(stage.gesture.active, false);
  });

  test("discards a gesture that ends without a preview", () => {
    const stage = createStage();

    stage.gesture.begin("crate");
    stage.gesture.end();

    assert.deepEqual(stage.calls, [["discard", "crate"]]);
  });

  const events = [
    {
      title: "interrupts when a peer touches the actor",
      emit: (stage: Stage) => stage.document.emit(
        "change",
        transformed("remote", "crate")
      ),
      interrupts: 1
    },
    {
      title: "interrupts when the document resets",
      emit: (stage: Stage) => stage.document.emit("reset"),
      interrupts: 1
    },
    {
      title: "ignores a peer touching another actor",
      emit: (stage: Stage) => stage.document.emit(
        "change",
        transformed("remote", "table")
      ),
      interrupts: 0
    },
    {
      title: "ignores its own local changes",
      emit: (stage: Stage) => stage.document.emit(
        "change",
        transformed("local", "crate")
      ),
      interrupts: 0
    }
  ];
  for (const { title, emit, interrupts } of events) {
    test(title, () => {
      const stage = createStage();

      stage.gesture.begin("crate");
      emit(stage);

      assert.equal(stage.interrupts, interrupts);
    });
  }
});
