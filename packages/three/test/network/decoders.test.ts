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

describe("decodePeerSelectionId", () => {
  test("accepts a string id", () => {
    assert.equal(decodePeerSelectionId("box-1"), "box-1");
  });

  test("accepts null as an explicit clear", () => {
    assert.equal(decodePeerSelectionId(null), null);
  });

  test("rejects a missing value", () => {
    assert.equal(decodePeerSelectionId(undefined), undefined);
  });

  test("rejects a non-string value", () => {
    assert.equal(decodePeerSelectionId(42), undefined);
    assert.equal(decodePeerSelectionId({ id: "box-1" }), undefined);
  });
});

describe("decodePeerHoverId", () => {
  test("accepts a string id", () => {
    assert.equal(decodePeerHoverId("box-1"), "box-1");
  });

  test("accepts null as an explicit clear", () => {
    assert.equal(decodePeerHoverId(null), null);
  });

  test("rejects a missing value", () => {
    assert.equal(decodePeerHoverId(undefined), undefined);
  });

  test("rejects a non-string value", () => {
    assert.equal(decodePeerHoverId(42), undefined);
    assert.equal(decodePeerHoverId({ id: "box-1" }), undefined);
  });
});

describe("decodePeerFrustumPose", () => {
  test("accepts a complete pose", () => {
    assert.deepEqual(decodePeerFrustumPose(kPose), kPose);
  });

  test("rejects null and non-objects", () => {
    assert.equal(decodePeerFrustumPose(null), undefined);
    assert.equal(decodePeerFrustumPose("pose"), undefined);
  });

  test("rejects a pose missing a component", () => {
    assert.equal(
      decodePeerFrustumPose({ position: kPose.position }),
      undefined
    );
    assert.equal(
      decodePeerFrustumPose({ quaternion: kPose.quaternion }),
      undefined
    );
  });

  test("rejects a quaternion missing w", () => {
    assert.equal(
      decodePeerFrustumPose({
        position: kPose.position,
        quaternion: { x: 0, y: 0, z: 0 }
      }),
      undefined
    );
  });

  test("rejects non-numeric components", () => {
    assert.equal(
      decodePeerFrustumPose({
        position: { x: "1", y: 2, z: 3 },
        quaternion: kPose.quaternion
      }),
      undefined
    );
  });
});
