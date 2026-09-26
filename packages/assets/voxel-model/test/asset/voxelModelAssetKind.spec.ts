// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetKindRegistry,
  InvalidAssetDocumentError
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND
} from "#src/asset/voxelModel.ts";
import {
  decodeVoxelModelDocument,
  voxelModelAssetKind,
  VoxelModelState
} from "#src/asset/voxelModelAssetKind.ts";
import { InvalidModelTreeError } from "#src/model/InvalidModelTreeError.ts";
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
      InvalidAssetDocumentError
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
      InvalidAssetDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({ version: 1, nodes: [] })),
      InvalidAssetDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({ version: 2 })),
      InvalidAssetDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({
        version: 2,
        nodes: [],
        texture: "tex"
      })),
      InvalidAssetDocumentError
    );
    assert.throws(
      () => decodeVoxelModelDocument(encode({
        version: 2,
        nodes: []
      })),
      InvalidAssetDocumentError
    );
  });

  test("rejects a block without its transform and UV layout", () => {
    const content = new TextEncoder().encode(JSON.stringify({
      version: 2,
      nodes: [
        {
          kind: "block",
          id: "a",
          parentId: null,
          name: "Block"
        }
      ],
      texture: kTexture
    }));

    assert.throws(
      () => decodeVoxelModelDocument(content),
      /\/nodes\/0/
    );
  });
});

describe("VoxelModelState.load", () => {
  test("rejects a document whose tree is broken", () => {
    const state = new VoxelModelState();
    const document = createVoxelModelDocument({ texture: kTexture });

    assert.throws(
      () => state.load({
        ...document,
        nodes: [folderNode("a", "ghost")]
      }),
      InvalidModelTreeError
    );
  });
});

describe("voxelModelAssetKind", () => {
  test("rebinds the texture reference on a copied model", () => {
    const handler = voxelModelAssetKind();
    const state = handler.create("model");
    state.load(createVoxelModelDocument({
      texture: { id: "original", kind: "pixelart" }
    }));

    handler.rebind?.(state, new Map([["original", "copied"]]));

    assert.deepEqual(handler.dependencies?.(state), [
      { id: "copied", kind: "pixelart" }
    ]);
  });

  test("declares its kind and claims .voxelmodel.json paths", () => {
    const handler = voxelModelAssetKind();

    assert.strictEqual(handler.kind, VOXEL_MODEL_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [VOXEL_MODEL_EXTENSION]);
    assert.strictEqual(handler.match, undefined);
  });

  test("resolves its documents but leaves plain JSON to the fallback", () => {
    const registry = new AssetKindRegistry([voxelModelAssetKind()]);

    assert.strictEqual(
      registry.resolve("models/hero.voxelmodel.json").kind,
      VOXEL_MODEL_KIND
    );
    assert.strictEqual(registry.resolve("models/hero.json").kind, "binary");
    assert.deepEqual(Object.keys(registry.contentTypes()), [
      VOXEL_MODEL_EXTENSION
    ]);
  });
});
