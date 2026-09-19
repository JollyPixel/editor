// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelModelState } from "#src/asset/VoxelModelState.ts";
import {
  createVoxelModelDocument,
  decodeVoxelModelDocument,
  encodeVoxelModelDocument
} from "#src/asset/document.ts";
import { InvalidVoxelModelDocumentError } from "#src/asset/InvalidVoxelModelDocumentError.ts";
import {
  TRANSFORM,
  groupAdded
} from "../helpers/commands.ts";

// CONSTANTS
const kTexture = {
  id: "texture-1",
  kind: "pixelart"
};

describe("VoxelModelState", () => {
  test("applies model and folder commands into one snapshot", () => {
    const state = new VoxelModelState();

    state.applyCommand(groupAdded("a", "Head"));
    state.applyCommand({ action: "group-renamed", uuid: "a", name: "Skull" });
    state.applyCommand({ action: "folder-added", uuid: "f", name: "Parts", parentId: null });
    state.applyCommand({ action: "block-placed", blockUuid: "a", folderId: "f" });

    assert.deepEqual(state.snapshot(), {
      nodes: [
        {
          uuid: "a",
          name: "Skull",
          parentUuid: null,
          ...TRANSFORM
        }
      ],
      folders: [{ uuid: "f", name: "Parts", parentId: null }],
      placements: [{ blockUuid: "a", folderId: "f" }]
    });
  });

  test("accepts additions and placements, and edits of known ids only", () => {
    const state = new VoxelModelState();

    assert.equal(state.accepts(groupAdded("a")), true);
    assert.equal(state.accepts({ action: "group-removed", uuid: "a" }), false);
    assert.equal(state.accepts({ action: "folder-renamed", uuid: "f", name: "x" }), false);
    assert.equal(state.accepts({ action: "block-unplaced", blockUuid: "a" }), true);

    state.applyCommand(groupAdded("a"));
    state.applyCommand({ action: "folder-added", uuid: "f", name: "F", parentId: null });

    assert.equal(state.accepts({ action: "group-removed", uuid: "a" }), true);
    assert.equal(state.accepts({ action: "folder-renamed", uuid: "f", name: "x" }), true);
  });

  test("its texture is its only dependency", () => {
    const state = new VoxelModelState();
    assert.deepEqual(state.dependencies(), []);

    state.load(createVoxelModelDocument({ texture: kTexture }));

    assert.deepEqual(state.dependencies(), [kTexture]);
    assert.deepEqual(state.texture, kTexture);
    state.clear();
    assert.equal(state.texture, null);
  });

  test("round-trips through the document codec", () => {
    const state = new VoxelModelState();
    state.load(createVoxelModelDocument({ texture: kTexture }));
    state.applyCommand(groupAdded("a"));

    const reloaded = new VoxelModelState();
    reloaded.load(decodeVoxelModelDocument(encodeVoxelModelDocument(state.toJSON())));

    assert.deepEqual(reloaded.toJSON(), state.toJSON());
  });
});

describe("decodeVoxelModelDocument", () => {
  test("rejects malformed documents", () => {
    function encode(
      value: unknown
    ): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(value));
    }

    assert.throws(
      () => decodeVoxelModelDocument(new TextEncoder().encode("{")),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({ version: 2, nodes: [], folders: [], placements: [] })),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({ version: 1, nodes: [], folders: [] })),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({
        version: 1,
        nodes: [],
        folders: [],
        placements: [],
        texture: "tex"
      })),
      InvalidVoxelModelDocumentError
    );
  });
});
