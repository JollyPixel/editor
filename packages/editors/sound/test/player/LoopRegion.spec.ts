// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LoopRegion } from "#src/player/LoopRegion.ts";

describe("LoopRegion", () => {
  for (const { title, loopStart, loopEnd, expected } of [
    {
      title: "keeps a region inside the sound",
      loopStart: 0.5,
      loopEnd: 1.5,
      expected: [0.5, 1.5]
    },
    {
      title: "runs to the end of the sound when the loop end is 0",
      loopStart: 0.5,
      loopEnd: 0,
      expected: [0.5, 2]
    },
    {
      title: "loops the whole sound when the loop start is not before its end",
      loopStart: 1.5,
      loopEnd: 1,
      expected: [0, 2]
    },
    {
      title: "loops from the start when the loop start is past the sound",
      loopStart: 3,
      loopEnd: 1,
      expected: [0, 1]
    }
  ]) {
    test(title, () => {
      const region = LoopRegion.resolve({
        loop: true,
        loopStart,
        loopEnd
      }, 2)!;

      assert.deepEqual([region.start, region.end], expected);
    });
  }
});
