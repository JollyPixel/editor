// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TrackPath } from "#src/model/values/TrackPath.ts";

describe("TrackPath", () => {
  test("compares segment by segment, trimmed and in any case", () => {
    const path = new TrackPath("Body/Arm.L");

    assert.equal(path.key, "body/arm.l");
    assert.equal(path.equals(" BODY / arm.l "), true);
    assert.equal(path.equals(new TrackPath("Body/Arm.R")), false);
  });

  test("names the block on its last segment", () => {
    assert.equal(new TrackPath("Body/Arm.L").blockName, "Arm.L");
    assert.equal(new TrackPath("Body").blockName, "Body");
  });
});
