// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { uvTargetKey } from "#src/uv/UVTarget.ts";

test("uvTargetKey distinguishes open slot names from region targets", () => {
  assert.notStrictEqual(
    uvTargetKey({
      regionId: "region",
      slot: "*"
    }),
    uvTargetKey({
      regionId: "region",
      slot: null
    })
  );
});

test("uvTargetKey cannot collide through delimiters", () => {
  assert.notStrictEqual(
    uvTargetKey({
      regionId: "a:b",
      slot: "c|d"
    }),
    uvTargetKey({
      regionId: "a",
      slot: "b:c|d"
    })
  );
});
