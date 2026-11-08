// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/client";
import { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";
import type {
  AssetDocumentKind,
  AssetLeases
} from "@jolly-pixel/editor.host";
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BlockMesh } from "#src/scene/blocks/BlockBody.ts";
import { ModelView } from "#src/viewer/ModelView.ts";
import {
  MODEL_TEXTURE_DOCUMENT_KIND,
  VOXEL_MODEL_DOCUMENT_KIND,
  VoxelModelViewer
} from "#src/viewer/VoxelModelViewer.ts";

// CONSTANTS
const kTexture: AssetReferenceData = {
  id: "texture-1",
  kind: PIXEL_ART_KIND
};
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

function createLeases() {
  const model = new ModelDocument();
  const pixels = new PixelDocument({ size: { x: 64, y: 64 } });
  const documents = new Map<AssetDocumentKind<unknown>, unknown>([
    [VOXEL_MODEL_DOCUMENT_KIND, model],
    [MODEL_TEXTURE_DOCUMENT_KIND, pixels]
  ]);
  const opened: string[] = [];
  const released: string[] = [];
  const loads = new Map<string, PromiseWithResolvers<void>>();
  const assets = {
    open: (kind: AssetDocumentKind<unknown>, assetId: string) => {
      opened.push(assetId);
      const document = documents.get(kind);
      assert.ok(document, `unexpected document kind for ${assetId}`);
      const load = Promise.withResolvers<void>();
      loads.set(assetId, load);

      return {
        document,
        ready: load.promise,
        release: () => released.push(assetId)
      };
    }
  };

  return {
    model,
    pixels,
    opened,
    released,
    loads,
    assets: assets as unknown as AssetLeases
  };
}

function setup() {
  const leases = createLeases();
  const viewer = new VoxelModelViewer({
    assets: leases.assets,
    dependencies: {
      listDependencies: (assetId) => (assetId === "model-1" ? [kTexture] : [])
    },
    modelId: "model-1"
  });
  const frames = { requested: 0 };
  const view = new ModelView({
    document: viewer.document,
    texture: viewer.texture,
    requestFrame: () => frames.requested++
  });
  leases.model.addBlock({ name: "Body" });

  return { ...leases, viewer, view, frames };
}

function blockMesh(
  view: ModelView
): BlockMesh {
  const [node] = view.root.children;

  return node.children[0] as BlockMesh;
}

describe("VoxelModelViewer", () => {
  it("draws the leased model with the texture the model links", () => {
    const { model, opened, viewer, view } = setup();

    assert.equal(viewer.document, model);
    assert.deepEqual(opened, ["model-1", "texture-1"]);
    assert.equal(blockMesh(view).material.map, viewer.texture.map);
  });

  it("is ready once the model and its texture are both loaded", async() => {
    const { viewer, loads } = setup();
    let ready = false;
    const settled = viewer.ready.then(() => {
      ready = true;
    });

    loads.get("model-1")?.resolve();
    await Promise.resolve();
    assert.equal(ready, false);
    loads.get("texture-1")?.resolve();
    await settled;
    assert.equal(ready, true);
  });

  it("refuses a model that links no texture, before leasing anything", () => {
    const { assets, opened } = createLeases();

    assert.throws(
      () => new VoxelModelViewer({
        assets,
        dependencies: {
          listDependencies: () => []
        },
        modelId: "model-1"
      }),
      /has no pixel-art texture/
    );
    assert.deepEqual(opened, []);
  });

  it("asks attached views for a frame when the texture is painted", () => {
    const { pixels, viewer, view, frames } = setup();
    const detach = viewer.attach(view);
    frames.requested = 0;

    pixels.paintPixels([{ x: 1, y: 1 }], kRed);
    assert.equal(frames.requested, 1);

    detach();
    pixels.paintPixels([{ x: 2, y: 2 }], kRed);
    assert.equal(frames.requested, 1);
  });

  it("remaps attached views when the texture is resized", () => {
    const { pixels, viewer, view } = setup();
    viewer.attach(view);
    const uv = blockMesh(view).geometry.getAttribute("uv");
    const before = uv.getX(0);

    pixels.resize({ x: 128, y: 128 });

    assert.ok(before > 0);
    assert.equal(uv.getX(0), before / 2);
  });

  it("releases the texture lease, then the model lease", () => {
    const { pixels, viewer, view, frames, released } = setup();
    viewer.attach(view);

    viewer.release();
    frames.requested = 0;
    pixels.paintPixels([{ x: 1, y: 1 }], kRed);

    assert.deepEqual(released, ["texture-1", "model-1"]);
    assert.equal(frames.requested, 0);
  });
});
