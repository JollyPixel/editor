// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetKindRegistry, InvalidAssetFileError } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  createVoxelModelFile,
  encodeVoxelModelFile,
  VOXEL_MODEL_EXTENSION,
  VOXEL_MODEL_KIND
} from "#src/asset/voxelModel.ts";
import {
  decodeVoxelModelFile,
  voxelModelAssetKind,
  VoxelModelState
} from "#src/asset/voxelModelAssetKind.ts";
import { InvalidModelTreeError } from "#src/model/errors/InvalidModelTreeError.ts";
import { BlockUvLayouts } from "#src/model/nodes/BlockUvLayouts.ts";
import {
  blockAdded,
  folderAdded,
  folderNode,
  blockNode
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
      ],
      materials: [],
      animationSets: []
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

    state.load(createVoxelModelFile({ texture: kTexture }));

    assert.deepEqual(state.dependencies(), [kTexture]);
    assert.deepEqual(state.texture, kTexture);
    state.clear();
    assert.equal(state.texture, null);
  });

  test("refuses to serialize before a document is loaded", () => {
    const state = new VoxelModelState();

    assert.throws(
      () => state.toJSON(),
      InvalidAssetFileError
    );
  });

  test("round-trips through the file codec", () => {
    const state = new VoxelModelState();
    state.load(createVoxelModelFile({ texture: kTexture }));
    state.applyCommand(blockAdded("a"));
    state.applyCommand(blockAdded("floor"));
    state.applyCommand({
      action: "node-shape-changed",
      id: "floor",
      shape: { type: "plane" },
      uv: BlockUvLayouts.net(undefined, { type: "plane" })
    });

    const reloaded = new VoxelModelState();
    reloaded.load(decodeVoxelModelFile(encodeVoxelModelFile(state.toJSON())));

    assert.deepEqual(reloaded.toJSON(), state.toJSON());
  });
});

describe("decodeVoxelModelFile", () => {
  test("rejects malformed documents", () => {
    function encode(
      value: unknown
    ): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(value));
    }

    assert.throws(
      () => decodeVoxelModelFile(new TextEncoder().encode("{")),
      InvalidAssetFileError
    );
    assert.throws(
      () => decodeVoxelModelFile(encode({ version: 1, nodes: [] })),
      InvalidAssetFileError
    );
    assert.throws(
      () => decodeVoxelModelFile(encode({ version: 2 })),
      InvalidAssetFileError
    );
    assert.throws(
      () => decodeVoxelModelFile(encode({
        version: 2,
        nodes: [],
        materials: [],
        texture: "tex"
      })),
      InvalidAssetFileError
    );
    assert.throws(
      () => decodeVoxelModelFile(encode({
        version: 2,
        nodes: [],
        materials: []
      })),
      InvalidAssetFileError
    );
    assert.throws(
      () => decodeVoxelModelFile(encode({
        version: 2,
        nodes: [],
        texture: kTexture
      })),
      InvalidAssetFileError
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
      materials: [],
      texture: kTexture
    }));

    assert.throws(
      () => decodeVoxelModelFile(content),
      /\/nodes\/0/
    );
  });

  test("rejects a stored transform part that is not a vector", () => {
    const content = new TextEncoder().encode(JSON.stringify({
      version: 2,
      nodes: [
        {
          kind: "block",
          id: "a",
          parentId: null,
          name: "Block",
          transform: { size: { x: 2 } },
          uv: BlockUvLayouts.net()
        }
      ],
      materials: [],
      animationSets: [],
      texture: kTexture
    }));

    assert.throws(
      () => decodeVoxelModelFile(content),
      /\/nodes\/0/
    );
  });
});

describe("VoxelModelState.load", () => {
  test("rejects a file whose tree is broken", () => {
    const state = new VoxelModelState();
    const file = createVoxelModelFile({ texture: kTexture });

    assert.throws(
      () => state.load({
        ...file,
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
    state.load(createVoxelModelFile({
      texture: { id: "original", kind: "pixelart" }
    }));

    handler.rebind?.(state, new Map([["original", "copied"]]));

    assert.deepEqual(handler.dependencies?.(state), [
      { id: "copied", kind: "pixelart" }
    ]);
  });

  test("lists linked animation sets as dependencies and rebinds them on a copy", () => {
    const handler = voxelModelAssetKind();
    const state = handler.create("model");
    state.load(createVoxelModelFile({ texture: kTexture }));
    state.applyCommand({
      action: "animation-set-linked",
      link: { id: "walk", kind: "voxelanimation", bindings: [] }
    });

    assert.deepEqual(handler.dependencies?.(state), [
      kTexture,
      { id: "walk", kind: "voxelanimation" }
    ]);

    handler.rebind?.(state, new Map([["walk", "walk-copy"]]));
    assert.deepEqual(state.snapshot().animationSets, [
      { id: "walk-copy", kind: "voxelanimation", bindings: [] }
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
