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
  blockAdded,
  blockNode,
  folderAdded,
  folderNode
} from "../helpers/commands.ts";

// CONSTANTS
const kTexture = {
  id: "texture-1",
  kind: "pixelart"
};

describe("VoxelModelState", () => {
  test("applies block and folder commands into one snapshot", () => {
    const state = new VoxelModelState();

    state.applyCommand(folderAdded("f"));
    state.applyCommand(blockAdded("a", "f"));
    state.applyCommand({ action: "node-renamed", id: "a", name: "Skull" });

    assert.deepEqual(state.snapshot(), {
      nodes: [
        folderNode("f"),
        { ...blockNode("a", "f"), name: "Skull" }
      ]
    });
  });

  test("accepts what its tree accepts", () => {
    const state = new VoxelModelState();

    assert.equal(state.accepts(blockAdded("a")), true);
    assert.equal(state.accepts(blockAdded("a", "missing")), false);
    assert.equal(state.accepts({ action: "node-removed", id: "a" }), false);

    state.applyCommand(blockAdded("a"));

    assert.equal(state.accepts({ action: "node-removed", id: "a" }), true);
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

  test("refuses to serialize before a document is loaded", () => {
    const state = new VoxelModelState();

    assert.throws(
      () => state.toJSON(),
      InvalidVoxelModelDocumentError
    );
  });

  test("round-trips through the document codec", () => {
    const state = new VoxelModelState();
    state.load(createVoxelModelDocument({ texture: kTexture }));
    state.applyCommand(blockAdded("a"));

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
      () => decodeVoxelModelDocument(encode({ version: 1, nodes: [] })),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({ version: 2 })),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({
        version: 2,
        nodes: [],
        texture: "tex"
      })),
      InvalidVoxelModelDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({
        version: 2,
        nodes: []
      })),
      InvalidVoxelModelDocumentError
    );
  });
});
