// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";
import {
  VOXEL_MAP_ASSET,
  type VoxelMapSource
} from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import {
  EditAssets,
  type MapViewer
} from "../../src/scene/EditAssets.ts";

interface FakeViewer extends MapViewer {
  mapId: string;
  attached: number;
  released: boolean;
}

function createAssets() {
  const viewers: FakeViewer[] = [];
  const assets = new EditAssets((mapId) => {
    const viewer: FakeViewer = {
      mapId,
      attached: 0,
      released: false,
      document: {} as VoxelMapSource["document"],
      attach: () => {
        viewer.attached++;

        return () => {
          viewer.attached--;
        };
      },
      release: () => {
        viewer.released = true;
      }
    };
    viewers.push(viewer);

    return viewer;
  });

  return { assets, viewers };
}

function resolveMap(
  assets: EditAssets,
  mapId: string
): VoxelMapSource {
  return assets.resolve({ id: mapId, kind: "voxelmap" }, VOXEL_MAP_ASSET);
}

const kView = {} as VoxelView;

describe("EditAssets", () => {
  test("shares one viewer between the components showing the same map", () => {
    const { assets, viewers } = createAssets();

    const first = resolveMap(assets, "map-a");
    const second = resolveMap(assets, "map-a");
    const other = resolveMap(assets, "map-b");
    first.attach(kView);
    second.attach(kView);
    other.attach(kView);

    assert.deepEqual(viewers.map((viewer) => viewer.mapId), ["map-a", "map-b"]);
    assert.strictEqual(first.document, second.document);
    assert.strictEqual(viewers[0].attached, 2);
  });

  test("releases a viewer once its last view detaches, but not across a rebuild", async() => {
    const { assets, viewers } = createAssets();
    const detachFirst = resolveMap(assets, "map").attach(kView);
    const detachSecond = resolveMap(assets, "map").attach(kView);

    detachFirst();
    detachSecond();
    const rebuilt = resolveMap(assets, "map").attach(kView);
    await Promise.resolve();
    assert.strictEqual(viewers.length, 1);
    assert.strictEqual(viewers[0].released, false);

    rebuilt();
    await Promise.resolve();
    assert.strictEqual(viewers[0].released, true);
    resolveMap(assets, "map");
    assert.strictEqual(viewers.length, 2);
  });

  test("refuses an asset type it does not serve", () => {
    const { assets } = createAssets();

    assert.throws(
      () => assets.resolve({ id: "t", kind: "texture" }, new AssetType<string>("texture")),
      /resolves no "texture" asset/
    );
  });

  test("releases every open viewer on dispose", () => {
    const { assets, viewers } = createAssets();
    resolveMap(assets, "map").attach(kView);

    assets.dispose();

    assert.strictEqual(viewers[0].released, true);
  });
});
