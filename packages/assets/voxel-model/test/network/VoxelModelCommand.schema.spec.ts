// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelModelCommandProtocol } from "#src/network/VoxelModelCommand.schema.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import { MaterialSurface } from "#src/model/materials/MaterialSurface.ts";
import {
  TRANSFORM,
  UV,
  blockNode,
  folderNode,
  material,
  materialFolder
} from "../helpers/commands.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kCommands: readonly VoxelModelCommand[] = [
  {
    action: "node-added",
    node: blockNode("node-1"),
    beforeId: "node-2"
  },
  {
    action: "node-removed",
    id: "node-1"
  },
  {
    action: "node-renamed",
    id: "node-1",
    name: "Renamed"
  },
  {
    action: "node-moved",
    id: "node-1",
    parentId: "node-2",
    transforms: [{ id: "node-1", transform: TRANSFORM }],
    beforeId: "node-3"
  },
  {
    action: "node-transformed",
    id: "node-1",
    transform: TRANSFORM
  },
  {
    action: "node-uv-changed",
    id: "node-1",
    uv: UV
  },
  {
    action: "node-material-changed",
    id: "node-1",
    materialId: "material-1"
  },
  {
    action: "material-added",
    material: material("material-1", "folder-1"),
    beforeId: "material-2"
  },
  {
    action: "material-folder-added",
    folder: materialFolder("folder-1")
  },
  {
    action: "material-moved",
    id: "material-1",
    parentId: null,
    beforeId: "folder-1"
  },
  {
    action: "material-removed",
    id: "material-1"
  },
  {
    action: "material-renamed",
    id: "material-1",
    name: "Glass"
  },
  {
    action: "material-changed",
    id: "material-1",
    surface: MaterialSurface.create()
  },
  {
    action: "animation-set-linked",
    link: {
      id: "set-1",
      kind: "voxelanimation",
      bindings: [{ path: "body/arm", target: null }]
    }
  },
  {
    action: "animation-set-unlinked",
    id: "set-1"
  },
  {
    action: "animation-set-owned",
    id: "set-1",
    own: false
  },
  {
    action: "animation-binding-changed",
    id: "set-1",
    path: "body/arm",
    target: "Body/Hand"
  },
  {
    action: "animation-binding-cleared",
    id: "set-1",
    path: "body/arm"
  }
];

function parse(
  payload: unknown
) {
  return new MessageParser(voxelModelCommandProtocol).parse(payload);
}

function accepts(
  payload: unknown
): boolean {
  return parse(payload).ok;
}

describe("voxelModelCommandProtocol", () => {
  test("declares one event per command action", () => {
    assert.deepStrictEqual(
      voxelModelCommandProtocol.events,
      kCommands.map((command) => command.action)
    );
  });

  for (const command of kCommands) {
    test(`parses ${command.action} to its action`, () => {
      const parsed = parse({ ...kHeader, ...command });

      assert.strictEqual(parsed.ok, true);
      assert.strictEqual(parsed.val.event, command.action);
    });

    test(`rejects ${command.action} without a network header`, () => {
      assert.strictEqual(accepts(command), false);
    });
  }

  test("rejects an unknown action", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-exploded", id: "node-1" }),
      false
    );
  });

  test("rejects a command missing a required field", () => {
    assert.strictEqual(accepts({ ...kHeader, action: "node-removed" }), false);
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-moved", id: "node-1", parentId: null }),
      false
    );
  });

  test("rejects a required field of the wrong type", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-removed", id: 42 }),
      false
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-moved",
        id: "node-1",
        parentId: 42,
        transforms: []
      }),
      false
    );
  });

  test("accepts a nullable parent", () => {
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-moved",
        id: "node-1",
        parentId: null,
        transforms: []
      }),
      true
    );
  });

  test("adds a folder or a block, told apart by kind", () => {
    assert.strictEqual(
      accepts({ ...kHeader, action: "node-added", node: folderNode("f") }),
      true
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-added",
        node: { ...folderNode("f"), kind: "group" }
      }),
      false
    );
    assert.strictEqual(
      accepts({
        ...kHeader,
        action: "node-added",
        node: { kind: "block", id: "b", parentId: null, name: "b" }
      }),
      false
    );
  });

  test("requires a valid UV layout on a block", () => {
    const { uv: _uv, ...unmapped } = blockNode("node-1");
    const added = {
      ...kHeader,
      action: "node-added",
      node: blockNode("node-1")
    };

    assert.strictEqual(accepts(added), true);
    assert.strictEqual(accepts({ ...added, node: unmapped }), false);
    assert.strictEqual(
      accepts({ ...added, node: { ...added.node, uv: { state: "stacked" } } }),
      false
    );
  });

  test("takes a null material id to clear a block's material but requires the field", () => {
    const command = {
      ...kHeader,
      action: "node-material-changed",
      id: "node-1"
    };

    assert.strictEqual(accepts({ ...command, materialId: null }), true);
    assert.strictEqual(accepts(command), false);
  });

  test("rejects a material surface out of range or with a malformed color", () => {
    const command = {
      ...kHeader,
      action: "material-changed",
      id: "material-1"
    };

    assert.strictEqual(
      accepts({ ...command, surface: MaterialSurface.create({ opacity: 1.5 }) }),
      false
    );
    assert.strictEqual(
      accepts({ ...command, surface: MaterialSurface.create({ color: "red" }) }),
      false
    );
  });

  test("takes a material removal that keeps a folder's contents", () => {
    const command = {
      ...kHeader,
      action: "material-removed",
      id: "folder-1"
    };

    assert.strictEqual(accepts({ ...command, keepContents: true }), true);
    assert.strictEqual(accepts({ ...command, keepContents: "yes" }), false);
  });

  test("takes a partial material surface but not an empty one or an unknown field", () => {
    const command = {
      ...kHeader,
      action: "material-changed",
      id: "material-1"
    };

    assert.strictEqual(accepts({ ...command, surface: { roughness: 0.2 } }), true);
    assert.strictEqual(accepts({ ...command, surface: {} }), false);
    assert.strictEqual(accepts({ ...command, surface: { shine: 1 } }), false);
  });

  test("rejects a UV change without a valid layout", () => {
    const command = {
      ...kHeader,
      action: "node-uv-changed",
      id: "node-1"
    };

    assert.strictEqual(accepts(command), false);
    assert.strictEqual(
      accepts({ ...command, uv: { state: "unfolded" } }),
      false
    );
  });

  test("treats flipAxes on node-transformed as optional", () => {
    const command = {
      ...kHeader,
      action: "node-transformed",
      id: "node-1",
      transform: TRANSFORM
    };

    assert.strictEqual(accepts(command), true);
    assert.strictEqual(
      accepts({
        ...command,
        flipAxes: { x: true, y: false, z: true }
      }),
      true
    );
    assert.strictEqual(
      accepts({
        ...command,
        flipAxes: { x: true, y: false }
      }),
      false
    );
  });
});
