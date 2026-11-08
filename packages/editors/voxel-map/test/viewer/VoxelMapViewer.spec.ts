// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  VoxelDocument
} from "@jolly-pixel/voxel.renderer";
import { VOXEL_MAP_ASSET } from "@jolly-pixel/voxel.renderer/engine";
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map/client";
import type {
  AssetDocumentKind,
  AssetLeases
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  VoxelMapViewer,
  VOXEL_MAP_DOCUMENT_KIND
} from "../../src/viewer/VoxelMapViewer.ts";
import {
  FakeSources,
  TERRAIN_BLOCKSET,
  makeCatalog,
  makeView
} from "../helpers/mapBlocksets.ts";

function setup() {
  const voxels = new VoxelDocument();
  voxels.addBlockset(TERRAIN_BLOCKSET);
  const sources = new FakeSources();
  const released: string[] = [];
  const loads = new Map<string, PromiseWithResolvers<void>>();
  function load(
    assetId: string
  ): Promise<void> {
    const loaded = Promise.withResolvers<void>();
    loads.set(assetId, loaded);

    return loaded.promise;
  }
  const assets = {
    open: (kind: AssetDocumentKind<unknown>, assetId: string) => {
      if (kind !== VOXEL_MAP_DOCUMENT_KIND) {
        const opened = sources.open(assetId);

        return {
          document: opened,
          room: opened.room,
          ready: load(assetId),
          release: () => {
            opened.release();
            released.push(assetId);
          }
        };
      }

      return {
        document: { voxels },
        ready: load(assetId),
        release: () => released.push(assetId)
      };
    }
  };
  const viewer = new VoxelMapViewer({
    assets: assets as unknown as AssetLeases,
    catalog: makeCatalog(),
    mapId: "map-1"
  });

  return { voxels, released, loads, viewer };
}

describe("VoxelMapViewer", () => {
  it("serves voxel maps to the VoxelMap component slot", () => {
    assert.equal(VOXEL_MAP_ASSET.kind.value, VOXEL_MAP_KIND);
  });

  it("draws the leased map with the blocks of its blocksets", () => {
    const { voxels, viewer } = setup();
    const view = makeView(viewer.document);

    viewer.attach(view);

    assert.equal(viewer.document, voxels);
    assert.equal(voxels.blocks.has(composeBlockId(1, 1)), true);
    assert.ok(view.atlases.get("terrain"));
  });

  it("is ready once the map and the blocksets it links are loaded", async() => {
    const { viewer, loads } = setup();
    let ready = false;
    const settled = viewer.ready.then(() => {
      ready = true;
    });

    loads.get("map-1")?.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(ready, false);
    loads.get("asset-terrain")?.resolve();
    await settled;
    assert.equal(ready, true);
  });

  it("releases its blockset leases, then the map lease", () => {
    const { viewer, released } = setup();

    viewer.release();

    assert.deepEqual(released, ["asset-terrain", "map-1"]);
  });
});
