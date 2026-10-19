// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as z from "zod/mini";
import { SNAPSHOT_POLICY_SCHEMA } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { KindOptionFields } from "../../../server/project/KindOptionFields.ts";

describe("KindOptionFields", () => {
  test("lists each number of the options schema with its path, titled label and bounds", () => {
    const fields = KindOptionFields.read(z.strictObject({
      blockset: z.optional(z.strictObject({
        tileSize: z.optional(z.int().check(z.minimum(1), z.maximum(64))),
        defaultSize: z.optional(z.object({
          x: z.int()
        })),
        snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
      })),
      palette: z.optional(z.string())
    }));

    assert.deepEqual([...fields], [
      {
        path: ["blockset", "tileSize"],
        label: "Blockset › Tile size",
        min: 1,
        max: 64
      },
      {
        path: ["blockset", "defaultSize", "x"],
        label: "Blockset › Default size › X",
        min: -Number.MAX_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER
      },
      {
        path: ["blockset", "snapshot", "delay"],
        label: "Blockset › Snapshot › Delay (ms)",
        min: 0,
        max: undefined
      },
      {
        path: ["blockset", "snapshot", "maxDelay"],
        label: "Blockset › Snapshot › Max delay (ms)",
        min: 0,
        max: undefined
      }
    ]);
  });
});
