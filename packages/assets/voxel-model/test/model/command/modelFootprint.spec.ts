// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelModelCommand } from "#src/model/types.ts";
import {
  modelFootprint,
  type ModelFootprint
} from "#src/model/command/modelCommands.ts";
import type { ModelValueRef } from "#src/model/command/ModelValueRef.ts";
import {
  TRANSFORM,
  UV,
  blockAdded,
  materialAdded,
  materialFolderAdded
} from "../../helpers/commands.ts";

// CONSTANTS
const kSurfaceFields = [
  "color",
  "opacity",
  "roughness",
  "metalness",
  "emissive",
  "emissiveIntensity"
];

function refs(
  id: string,
  ...kinds: Exclude<ModelValueRef["kind"], "material-surface" | "animation-binding">[]
): ModelValueRef[] {
  return kinds.map((kind) => {
    return { kind, id };
  });
}

function surface(
  id: string,
  ...fields: string[]
): ModelValueRef[] {
  return fields.map((field) => {
    return { kind: "material-surface", id, field };
  });
}

function footprint(
  node: string | null,
  writes: ModelValueRef[] | null,
  conflicts: ModelValueRef[] = writes ?? []
): ModelFootprint {
  return { node, writes, conflicts };
}

describe("modelFootprint", () => {
  const cases: [VoxelModelCommand, ModelFootprint][] = [
    [
      { action: "node-transformed", id: "n", transform: TRANSFORM },
      footprint("n", refs("n", "transform"))
    ],
    [
      {
        action: "node-transformed",
        id: "n",
        transform: TRANSFORM,
        flipAxes: { x: true, y: false, z: false }
      },
      footprint("n", refs("n", "transform", "flip"))
    ],
    [
      { action: "node-renamed", id: "n", name: "X" },
      footprint("n", refs("n", "name"))
    ],
    [
      {
        action: "node-moved",
        id: "folder",
        parentId: null,
        transforms: [{ id: "a", transform: TRANSFORM }, { id: "b", transform: TRANSFORM }]
      },
      footprint("folder", null, [
        ...refs("folder", "parent"),
        ...refs("a", "transform"),
        ...refs("b", "transform")
      ])
    ],
    [blockAdded("n"), footprint("n", null)],
    [
      { action: "node-removed", id: "n" },
      footprint("n", null, refs("n", "name", "parent", "transform", "flip", "uv", "shape", "material"))
    ],
    [
      { action: "node-uv-changed", id: "n", uv: UV },
      footprint("n", refs("n", "uv"))
    ],
    [
      { action: "node-shape-changed", id: "n", shape: { type: "plane" }, uv: UV },
      footprint("n", refs("n", "shape", "uv"))
    ],
    [
      { action: "node-material-changed", id: "n", materialId: null },
      footprint("n", refs("n", "material"))
    ],
    [
      { action: "material-renamed", id: "glass", name: "Glass" },
      footprint(null, refs("glass", "material-name"))
    ],
    [
      { action: "material-changed", id: "glass", surface: { opacity: 0.5, roughness: 0.2 } },
      footprint(null, surface("glass", "opacity", "roughness"))
    ],
    [
      { action: "material-moved", id: "glass", parentId: "metals" },
      footprint(null, null, refs("glass", "material-parent"))
    ],
    [materialAdded("glass"), footprint(null, null)],
    [materialFolderAdded("metals"), footprint(null, null)],
    [
      { action: "material-removed", id: "glass" },
      footprint(null, null, [
        ...refs("glass", "material-name", "material-parent"),
        ...surface("glass", ...kSurfaceFields)
      ])
    ]
  ];

  for (const [command, expected] of cases) {
    it(`covers what ${command.action} writes and conflicts with`, () => {
      assert.deepEqual(modelFootprint(command), expected);
    });
  }
});
