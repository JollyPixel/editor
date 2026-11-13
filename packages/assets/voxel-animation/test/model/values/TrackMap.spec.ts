// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TrackMap } from "#src/model/values/TrackMap.ts";

function tracks(
  ...paths: string[]
): TrackMap<{ path: string; value: number; }> {
  return new TrackMap(paths.map((path, value) => {
    return { path, value };
  }));
}

describe("TrackMap", () => {
  test("finds an entry by path in any case, and replaces it in place", () => {
    const map = tracks("Body/Arm", "Body/Leg").with({ path: "BODY/ARM", value: 9 });

    assert.deepEqual([...map.paths()], ["BODY/ARM", "Body/Leg"]);
    assert.equal(map.get("body/ arm ")?.value, 9);
    assert.deepEqual([...map.without("body/arm").paths()], ["Body/Leg"]);
  });

  test("refuses a path another entry holds when built or mapped", () => {
    const map = tracks("Body/Arm", "Body/Leg");

    assert.throws(() => tracks("Body/Arm", "body/arm"), RangeError);
    assert.throws(() => map.map((entry) => {
      return { ...entry, path: "Torso" };
    }), RangeError);
  });
});
