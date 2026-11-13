// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AssetKindEntry } from "../../src/catalog/AssetKindSet.ts";
import { CapabilityCatalog } from "../../src/project/CapabilityCatalog.ts";
import type { PermissionRow } from "../../src/project/permissions/PermissionRow.ts";
import { RoleRules } from "../../src/project/RoleRules.ts";

// CONSTANTS
const kVoxelMap: AssetKindEntry = {
  kind: "voxelmap",
  label: "Voxel map",
  extension: ".voxelmap.json",
  extensions: [".voxelmap.json"],
  capabilities: [
    {
      name: "voxels",
      label: "Voxels",
      events: ["voxel-set", "voxels-set"]
    },
    {
      name: "layers",
      label: "Layers",
      events: ["added"]
    }
  ]
};
const kText: AssetKindEntry = {
  kind: "text",
  label: "Text",
  extension: ".md",
  extensions: [".md"]
};
const kCatalog = new CapabilityCatalog([kVoxelMap, kText]);
const kMember = RoleRules.from({
  "*": "write"
});
const kSpectator = RoleRules.from({
  "*.$join": "write",
  "*.$presence": "write",
  "*": "read"
});

function groups(): [string, readonly PermissionRow[]][] {
  return [
    ["project", kCatalog.project],
    ...kCatalog.kinds.map((kind): [string, readonly PermissionRow[]] => [
      kind.id,
      [kind, ...kind.capabilities]
    ])
  ];
}

function row(
  label: string,
  group = "voxelmap"
): PermissionRow {
  const found = groups()
    .find(([id]) => id === group)?.[1]
    .find((candidate) => candidate.label === label);
  assert.ok(found, `${group} has a "${label}" row`);

  return found;
}

function display(
  rules: RoleRules
): Record<string, Record<string, string>> {
  return Object.fromEntries(groups().map(([id, rows]) => [
    id,
    Object.fromEntries(rows.map((candidate) => [
      candidate.label,
      candidate.rightIn(rules)
    ]))
  ]));
}

describe("CapabilityCatalog", () => {
  test("lists the project rights, then each kind with its declared capabilities", () => {
    assert.deepEqual(
      groups().map(([id, rows]) => [id, rows.map(({ label }) => label)]),
      [
        ["project", ["Assets", "Share links", "Export", "Settings", "Audit"]],
        ["voxelmap", ["Voxel map", "Voxels", "Layers"]],
        ["text", ["Text"]]
      ]
    );
  });

  test("shows the right first-match evaluation gives, named rights ignoring wildcards", () => {
    assert.deepEqual(display(kMember), {
      project: {
        Assets: "write",
        "Share links": "write",
        Export: "write",
        Settings: "void",
        Audit: "void"
      },
      voxelmap: {
        "Voxel map": "write",
        Voxels: "write",
        Layers: "write"
      },
      text: {
        Text: "write"
      }
    });
    assert.deepEqual(display(kSpectator), {
      project: {
        Assets: "read",
        "Share links": "void",
        Export: "void",
        Settings: "void",
        Audit: "void"
      },
      voxelmap: {
        "Voxel map": "read",
        Voxels: "read",
        Layers: "read"
      },
      text: {
        Text: "read"
      }
    });
  });

  test("a kind its role cannot join shows none, whatever its other rules give", () => {
    const rules = RoleRules.from({
      "voxelmap.$join": "read",
      "*": "write"
    });

    assert.equal(row("Voxel map").rightIn(rules), "void");
    assert.equal(row("Voxels").reachable(rules), false);
    assert.equal(row("Voxels").reachable(kSpectator), true);
  });

  test("a capability shows the lowest right among its events, its kind mixed when they differ", () => {
    const rules = kMember.withExact({ "voxelmap.voxels-set": "read" });

    assert.equal(row("Voxels").rightIn(rules), "read");
    assert.equal(row("Layers").rightIn(rules), "write");
    assert.equal(row("Voxel map").rightIn(rules), "mixed");
  });

  test("every row shows back the right it was set to, above any older rule", () => {
    for (const rules of [kMember, kSpectator]) {
      for (const [id, rows] of groups()) {
        for (const candidate of rows) {
          for (const right of candidate.options) {
            assert.equal(
              candidate.rightIn(candidate.applyTo(rules, right)),
              right,
              `${id} ${candidate.label} set to ${right}`
            );
          }
        }
      }
    }
  });

  test("setting a whole kind replaces its own rules, so its capabilities follow it", () => {
    const customized = row("Voxels").applyTo(
      kMember.withExact({ "text.*": "void" }),
      "void"
    );
    const read = row("Voxel map").applyTo(customized, "read");

    assert.deepEqual(read.toJSON(), {
      "voxelmap.$join": "write",
      "voxelmap.$presence": "write",
      "voxelmap.*": "read",
      "text.*": "void",
      "*": "write"
    });
    assert.equal(row("Voxels").rightIn(read), "read");
  });

  test("lists every key a rule can name, for the room probe", () => {
    assert.deepEqual(
      kCatalog.eventKeys.filter((key) => key.startsWith("voxelmap.")),
      [
        "voxelmap.$join",
        "voxelmap.$presence",
        "voxelmap.voxel-set",
        "voxelmap.voxels-set",
        "voxelmap.added"
      ]
    );
  });
});
