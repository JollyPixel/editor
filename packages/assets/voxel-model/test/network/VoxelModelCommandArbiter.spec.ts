// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelModelNetworkCommand } from "#src/network/types.ts";
import { voxelModelConflictKeys, voxelModelWriteKeys } from "#src/network/VoxelModelCommandKeys.ts";
import {
  TRANSFORM,
  UV,
  blockAdded,
  materialAdded,
  materialFolderAdded,
  networkCommand
} from "../helpers/commands.ts";

function transformed(
  id = "node-1",
  overrides: Parameters<typeof networkCommand>[1] = {}
): VoxelModelNetworkCommand {
  return networkCommand({
    action: "node-transformed",
    id,
    transform: TRANSFORM
  }, overrides);
}

function moved(
  id: string,
  transformedIds: string[],
  overrides: Parameters<typeof networkCommand>[1] = {}
): VoxelModelNetworkCommand {
  return networkCommand({
    action: "node-moved",
    id,
    parentId: null,
    transforms: transformedIds.map((transformedId) => {
      return {
        id: transformedId,
        transform: TRANSFORM
      };
    })
  }, overrides);
}

describe("voxelModelConflictKeys", () => {
  const cases: [VoxelModelNetworkCommand, string[]][] = [
    [transformed(), ["transform:node-1"]],
    [
      networkCommand({
        action: "node-renamed",
        id: "node-1",
        name: "X"
      }),
      ["name:node-1"]
    ],
    [
      moved("folder-1", ["a", "b"]),
      ["parent:folder-1", "transform:a", "transform:b"]
    ],
    [networkCommand(blockAdded("n")), []],
    [
      networkCommand({ action: "node-removed", id: "n" }),
      ["name:n", "parent:n", "transform:n", "uv:n", "shape:n", "material:n"]
    ],
    [
      networkCommand({
        action: "node-uv-changed",
        id: "node-1",
        uv: UV
      }),
      ["uv:node-1"]
    ],
    [
      networkCommand({
        action: "node-shape-changed",
        id: "node-1",
        shape: { type: "plane" },
        uv: UV
      }),
      ["shape:node-1", "uv:node-1"]
    ],
    [
      networkCommand({
        action: "node-material-changed",
        id: "node-1",
        materialId: null
      }),
      ["material:node-1"]
    ],
    [
      networkCommand({
        action: "material-renamed",
        id: "glass",
        name: "Glass"
      }),
      ["material-name:glass"]
    ],
    [
      networkCommand({
        action: "material-changed",
        id: "glass",
        surface: {
          opacity: 0.5,
          roughness: 0.2
        }
      }),
      ["material-surface:glass:opacity", "material-surface:glass:roughness"]
    ],
    [
      networkCommand({
        action: "material-moved",
        id: "glass",
        parentId: "metals"
      }),
      ["material-parent:glass"]
    ],
    [networkCommand(materialAdded("glass")), []],
    [networkCommand(materialFolderAdded("metals")), []],
    [
      networkCommand({ action: "material-removed", id: "glass" }),
      [
        "material-name:glass",
        "material-parent:glass",
        "material-surface:glass:color",
        "material-surface:glass:opacity",
        "material-surface:glass:roughness",
        "material-surface:glass:metalness",
        "material-surface:glass:emissive",
        "material-surface:glass:emissiveIntensity"
      ]
    ]
  ];

  for (const [command, expected] of cases) {
    it(`keys ${command.action} as [${expected.join(", ")}]`, () => {
      assert.deepEqual(voxelModelConflictKeys(command), expected);
    });
  }
});

describe("voxelModelWriteKeys", () => {
  const cases: [VoxelModelNetworkCommand, string[] | null][] = [
    [
      networkCommand({
        action: "node-material-changed",
        id: "node-1",
        materialId: "glass"
      }),
      ["material:node-1"]
    ],
    [
      networkCommand({
        action: "material-renamed",
        id: "glass",
        name: "Glass"
      }),
      ["material-name:glass"]
    ],
    [
      networkCommand({
        action: "material-changed",
        id: "glass",
        surface: { opacity: 0.5, roughness: 0.2 }
      }),
      ["material-surface:glass:opacity", "material-surface:glass:roughness"]
    ],
    [
      networkCommand({
        action: "material-moved",
        id: "glass",
        parentId: null
      }),
      null
    ],
    [networkCommand({ action: "material-removed", id: "glass" }), null]
  ];

  for (const [command, expected] of cases) {
    it(`keys ${command.action} as ${expected === null ? "null" : `[${expected.join(", ")}]`}`, () => {
      assert.deepEqual(voxelModelWriteKeys(command), expected);
    });
  }
});
