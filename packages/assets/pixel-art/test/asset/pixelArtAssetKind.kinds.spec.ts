// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SchemaParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { ASSET_KINDS, PIXEL_ART_KIND } from "#src/index.ts";

describe("ASSET_KINDS", () => {
  test("describes every kind it handles", () => {
    const handlers = ASSET_KINDS.handlers();

    assert.deepEqual(
      handlers.map((handler) => handler.kind),
      [PIXEL_ART_KIND]
    );
    assert.deepEqual(
      ASSET_KINDS.descriptors.map((descriptor) => descriptor.kind),
      [PIXEL_ART_KIND]
    );
  });

  test("accepts only the JSON options of the handler", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);

    assert.ok(parser.parse({
      defaultSize: {
        x: 64,
        y: 64
      }
    }).ok);
    for (const options of [
      { defaultSize: { x: 0, y: 64 } },
      { size: 64 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
