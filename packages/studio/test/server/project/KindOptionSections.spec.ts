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
import { KindOptionSections } from "../../../server/project/KindOptionSections.ts";

// CONSTANTS
const kSnapshotGroup = {
  label: "Snapshot",
  fields: [
    {
      type: "number",
      path: ["blockset", "snapshot", "delay"],
      label: "Delay (ms)",
      min: 0,
      max: undefined,
      default: undefined
    },
    {
      type: "number",
      path: ["blockset", "snapshot", "maxDelay"],
      label: "Max delay (ms)",
      min: 0,
      max: undefined,
      default: undefined
    }
  ]
};

describe("KindOptionSections", () => {
  test("puts each kind's options under a section named after the kind, nested objects in groups", () => {
    const sections = KindOptionSections.read(
      z.strictObject({
        blockset: z.optional(z.strictObject({
          tileSize: z.optional(z.int().check(
            z.minimum(1),
            z.maximum(64),
            z.meta({ default: 32 })
          )),
          snapshot: z.optional(SNAPSHOT_POLICY_SCHEMA)
        })),
        palette: z.optional(z.string()),
        quality: z.optional(z.strictObject({
          bake: z.optional(z.strictObject({
            samples: z.optional(z.number())
          }))
        }))
      }),
      [{ kind: "blockset", label: "Blockset", extension: "blockset" }]
    );

    assert.deepEqual([...sections], [
      {
        label: null,
        fields: [],
        groups: [
          {
            path: ["quality"],
            label: "Quality",
            fields: [
              {
                type: "number",
                path: ["quality", "bake", "samples"],
                label: "Bake › Samples",
                min: undefined,
                max: undefined,
                default: undefined
              }
            ]
          }
        ]
      },
      {
        label: "Blockset",
        fields: [
          {
            type: "number",
            path: ["blockset", "tileSize"],
            label: "Tile size",
            min: 1,
            max: 64,
            default: 32
          }
        ],
        groups: [
          {
            ...kSnapshotGroup,
            path: ["blockset", "snapshot"]
          }
        ]
      }
    ]);
  });

  test("reads an x and y object with a default as one vector2 field within both axes' bounds", () => {
    const sections = KindOptionSections.read(
      z.strictObject({
        defaultSize: z.optional(z.object({
          x: z.int().check(z.gt(0), z.lt(200)),
          y: z.number().check(z.maximum(256))
        }).check(z.meta({ default: { x: 32, y: 32 } }))),
        origin: z.optional(z.object({
          x: z.number(),
          y: z.number()
        }))
      }),
      []
    );

    assert.deepEqual([...sections], [
      {
        label: null,
        fields: [
          {
            type: "vector2",
            path: ["defaultSize"],
            label: "Default size",
            min: 1,
            max: 199,
            default: { x: 32, y: 32 }
          }
        ],
        groups: [
          {
            path: ["origin"],
            label: "Origin",
            fields: [
              {
                type: "number",
                path: ["origin", "x"],
                label: "X",
                min: undefined,
                max: undefined,
                default: undefined
              },
              {
                type: "number",
                path: ["origin", "y"],
                label: "Y",
                min: undefined,
                max: undefined,
                default: undefined
              }
            ]
          }
        ]
      }
    ]);
  });
});
