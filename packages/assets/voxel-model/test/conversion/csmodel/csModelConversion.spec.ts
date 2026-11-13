// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ConvertedAsset } from "@jolly-pixel/asset-server";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  VOXEL_MODEL_FILE,
  voxelModelAssetKind,
  type VoxelModelFile
} from "#src/index.ts";
import type { BlockNodeJSON } from "#src/model/types.ts";
import { InvalidCsModelError } from "#src/conversion/csmodel/errors/InvalidCsModelError.ts";
import {
  csModelBytes,
  transparentPng,
  type CsModelSpec
} from "../../helpers/csModel.ts";

interface Converted {
  model: VoxelModelFile;
  companion: NonNullable<ConvertedAsset["companions"]>[number];
}

async function convert(
  spec: CsModelSpec
): Promise<Converted> {
  const conversion = voxelModelAssetKind().conversions?.[".csmodel"];
  assert.ok(conversion);
  const converted = await conversion(csModelBytes(spec));
  const [companion] = converted.companions ?? [];
  assert.ok(companion);

  return {
    model: VOXEL_MODEL_FILE.decode(converted.content),
    companion
  };
}

function block(
  model: VoxelModelFile,
  id: string
): BlockNodeJSON {
  const node = model.nodes.find((candidate) => candidate.id === id);
  assert.ok(node?.kind === "block");

  return node;
}

describe("voxelModelAssetKind .csmodel conversion", () => {
  test("hangs children from the parent's box and bakes stretch into the block", async() => {
    const halfTurn = Math.SQRT1_2;
    const { model } = await convert({
      nodes: [
        {
          id: 1,
          name: "Body",
          position: [1, 2, 3],
          offset: [0.5, 0, -0.25],
          stretch: [2, 1, -1],
          orientation: [halfTurn, 0, 0, halfTurn],
          size: [16, 8, 32]
        },
        {
          id: 2,
          parentId: 1,
          name: "Head",
          position: [0, 1, 0]
        }
      ]
    });

    const body = block(model, "cs-1");
    const { rotation, ...transform } = body.transform;
    assert.strictEqual(body.name, "Body");
    assert.deepStrictEqual(transform, {
      position: { x: 1, y: 2, z: 3 },
      pivotOffset: { x: -1, y: 0, z: -0.25 },
      size: { x: 2, y: 0.5, z: 2 },
      scale: { x: 1, y: 1, z: 1 }
    });
    assert.deepStrictEqual(body.flipAxes, { x: false, y: false, z: true });
    assert.ok(Math.abs(rotation.z - (Math.PI / 2)) < 1e-6);
    assert.ok(Math.abs(rotation.x) < 1e-6 && Math.abs(rotation.y) < 1e-6);

    const head = block(model, "cs-2");
    assert.strictEqual(head.parentId, "cs-1");
    assert.deepStrictEqual(head.transform.position, { x: 0.5, y: 1, z: -0.25 });
    assert.deepStrictEqual(head.flipAxes, { x: false, y: false, z: false });
  });

  test("mirrors then turns each face around its texture offset", async() => {
    const { model } = await convert({
      nodes: [
        {
          id: 1,
          size: [16, 8, 4],
          faces: [[0, 0], [24, 0], [36, 0], [44, 16], [52, 8], [-12, 20]],
          flags: [0, 1, 8, 9, 24, 4]
        }
      ]
    });

    const { uv } = block(model, "cs-1");
    assert.strictEqual(uv.state, "free");
    assert.deepStrictEqual(uv.faces, {
      front: { x: 0, y: 0, width: 16, height: 8 },
      back: { x: 16, y: 0, width: 8, height: 16, rotation: 1 },
      right: { x: 32, y: 0, width: 4, height: 8, mirrored: true },
      bottom: { x: 40, y: 0, width: 4, height: 16, rotation: 1, mirrored: true },
      left: { x: 48, y: 0, width: 4, height: 8, rotation: 2 },
      top: { x: 52, y: 4, width: 4, height: 16, rotation: 3 }
    });
  });

  test("keeps a zero-size pivot block thin but with every face", async() => {
    const { model } = await convert({
      nodes: [{ id: 1, size: [0, 0, 0] }]
    });

    const pivot = block(model, "cs-1");
    assert.deepStrictEqual(
      pivot.transform.size,
      { x: 0.001, y: 0.001, z: 0.001 }
    );
    assert.strictEqual(Object.keys(pivot.uv.faces ?? {}).length, 6);
    assert.deepStrictEqual(pivot.uv.faces?.top, { x: 0, y: 0, width: 1, height: 1 });
  });

  test("turns the texture into a pixel-art companion the model references", async() => {
    const { model, companion } = await convert({
      nodes: [{ id: 1 }],
      texture: transparentPng(64, 32)
    });

    assert.deepStrictEqual(model.texture, {
      id: companion.id,
      kind: PIXEL_ART_KIND
    });
    assert.strictEqual(companion.kind, PIXEL_ART_KIND);
    const texture = pixelArtAssetKind();
    const state = texture.create("texture");
    texture.load(state, companion.content);
    assert.deepStrictEqual(state.document.buffer.size(), { x: 64, y: 32 });
  });

  test("refuses another format version and truncated data", async() => {
    await assert.rejects(
      convert({ version: 4, nodes: [] }),
      InvalidCsModelError
    );
    await assert.rejects(
      convert({ nodes: [{ id: 1 }], texture: new Uint8Array([1, 2, 3]) }),
      InvalidCsModelError
    );

    const conversion = voxelModelAssetKind().conversions?.[".csmodel"];
    const truncated = csModelBytes({ nodes: [{ id: 1 }] }).subarray(0, 40);
    await assert.rejects(conversion?.(truncated) ?? Promise.resolve(), InvalidCsModelError);
  });
});
