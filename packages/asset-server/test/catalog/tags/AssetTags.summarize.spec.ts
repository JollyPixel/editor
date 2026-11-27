// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UnknownTagError } from "#src/index.ts";
import {
  tagHarness,
  TAG_ACTOR
} from "../../helpers/tags/tagHarness.ts";

describe("AssetTags — summarize", () => {
  test("the kind describes the change between two tagged contents", async() => {
    await using harness = await tagHarness();
    const { assetId, tags } = harness;
    await harness.increment();
    (await tags.create({ assetId, name: "v1", actor: TAG_ACTOR })).unwrap();
    await harness.increment();
    await harness.increment();
    (await tags.create({ assetId, name: "v2", actor: TAG_ACTOR })).unwrap();

    assert.strictEqual((await tags.summarize(assetId, "v1", "v2")).unwrap(), "1 to 3");

    const missing = await tags.summarize(assetId, "v1", "v3");
    assert.ok(!missing.ok);
    assert.ok(missing.val instanceof UnknownTagError);
  });
});
