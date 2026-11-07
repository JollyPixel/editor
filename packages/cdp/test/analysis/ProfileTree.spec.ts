// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { CallFrame } from "../../src/analysis/CallFrame.ts";
import { ProfileTree } from "../../src/analysis/ProfileTree.ts";
import { TimeWindow } from "../../src/analysis/TimeWindow.ts";

describe("ProfileTree", () => {
  test("weighs each CPU sample by the time until the next one, within the window", () => {
    const profile = {
      nodes: [
        node(1, "(root)", [2, 3]),
        node(2, "load"),
        node(3, "render")
      ],
      samples: [2, 3, 2],
      timeDeltas: [0, 1_000, 2_000]
    };

    const whole = ProfileTree.fromCpuProfile(profile);
    const windowed = ProfileTree.fromCpuProfile(profile, TimeWindow.between(1));

    assert.deepEqual(weights(whole), [["load", 1_000], ["render", 2_000]]);
    assert.deepEqual(weights(windowed), [["render", 2_000], ["load", 0]]);
  });

  test("walks a node's stack up to the root without yielding it", () => {
    const tree = ProfileTree.fromCpuProfile({
      nodes: [
        node(1, "(root)", [2]),
        node(2, "main", [3]),
        node(3, "draw")
      ],
      samples: [3],
      timeDeltas: [0]
    });
    const [draw] = tree.nodes();

    assert.deepEqual(
      Array.from(draw.stack(), (callFrame) => callFrame.functionName),
      ["draw", "main"]
    );
  });

  test("sums the self size of every node of a heap profile", () => {
    const profile = {
      head: {
        id: 1,
        callFrame: callFrame("(root)"),
        selfSize: 0,
        children: [
          {
            id: 2,
            callFrame: callFrame("load"),
            selfSize: 64,
            children: [
              {
                id: 3,
                callFrame: callFrame("parse"),
                selfSize: 32,
                children: []
              }
            ]
          }
        ]
      }
    };

    assert.equal(ProfileTree.fromHeapProfile(profile).total, 96);
  });
});

function node(
  id: number,
  functionName: string,
  children: number[] = []
) {
  return {
    id,
    callFrame: callFrame(functionName),
    children
  };
}

function callFrame(
  functionName: string
): CallFrame {
  return {
    functionName,
    url: "",
    lineNumber: 0,
    columnNumber: 0
  };
}

function weights(
  tree: ProfileTree
): [string, number][] {
  return Array.from(tree.nodes(), ({ frame, weight }) => [frame.functionName, weight]);
}
