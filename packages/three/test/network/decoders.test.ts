// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodePeerSelectionId,
  decodePeerHoverId,
  decodePeerFrustumPose
} from "#src/network/index.ts";

// CONSTANTS
const kPose = {
  position: { x: 1, y: 2, z: 3 },
  quaternion: { x: 0, y: 1, z: 0, w: 0 }
};
const kIdDecoders = [
  ["decodePeerSelectionId", decodePeerSelectionId],
  ["decodePeerHoverId", decodePeerHoverId]
] as const;
const kMalformedIds: Array<[string, unknown]> = [
  ["a missing value", undefined],
  ["a number", 42],
  ["an object", { id: "box-1" }]
];
const kMalformedPoses: Array<[string, unknown]> = [
  ["null", null],
  ["a non-object", "pose"],
  ["a pose missing its quaternion", { position: kPose.position }],
  ["a pose missing its position", { quaternion: kPose.quaternion }],
  [
    "a quaternion missing w",
    {
      position: kPose.position,
      quaternion: { x: 0, y: 0, z: 0 }
    }
  ],
  [
    "a non-numeric component",
    {
      position: { x: "1", y: 2, z: 3 },
      quaternion: kPose.quaternion
    }
  ]
];

for (const [name, decode] of kIdDecoders) {
  describe(name, () => {
    test("accepts a string id", () => {
      assert.equal(decode("box-1"), "box-1");
    });

    test("accepts null as an explicit clear", () => {
      assert.equal(decode(null), null);
    });

    for (const [label, value] of kMalformedIds) {
      test(`rejects ${label}`, () => {
        assert.equal(decode(value), undefined);
      });
    }
  });
}

describe("decodePeerFrustumPose", () => {
  test("accepts a complete pose", () => {
    assert.deepEqual(decodePeerFrustumPose(kPose), kPose);
  });

  for (const [label, value] of kMalformedPoses) {
    test(`rejects ${label}`, () => {
      assert.equal(decodePeerFrustumPose(value), undefined);
    });
  }
});
