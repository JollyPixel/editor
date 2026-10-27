// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelView } from "@jolly-pixel/voxel.renderer";
import type { VoxelMapSource } from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import {
  SharedVoxelMaps,
  type MapViewer
} from "../../src/sceneComponents/SharedVoxelMaps.ts";

interface FakeViewer extends MapViewer {
  mapId: string;
  attached: number;
  released: boolean;
}

// CONSTANTS
const kView = {} as VoxelView;

function createMaps() {
  const viewers: FakeViewer[] = [];
  const maps = new SharedVoxelMaps((mapId) => {
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

  return { maps, viewers };
}

function resolveMap(
  maps: SharedVoxelMaps,
  mapId: string
): VoxelMapSource {
  return maps.resolve({ id: mapId, kind: "voxelmap" });
}

describe("SharedVoxelMaps", () => {
  it("shares one viewer between the components showing the same map", () => {
    const { maps, viewers } = createMaps();

    const first = resolveMap(maps, "map-a");
    const second = resolveMap(maps, "map-a");
    const other = resolveMap(maps, "map-b");
    first.attach(kView);
    second.attach(kView);
    other.attach(kView);

    assert.deepEqual(viewers.map((viewer) => viewer.mapId), ["map-a", "map-b"]);
    assert.strictEqual(first.document, second.document);
    assert.strictEqual(viewers[0].attached, 2);
  });

  it("releases a viewer once its last view detaches, but not across a rebuild", async() => {
    const { maps, viewers } = createMaps();
    const detachFirst = resolveMap(maps, "map").attach(kView);
    const detachSecond = resolveMap(maps, "map").attach(kView);

    detachFirst();
    detachSecond();
    const rebuilt = resolveMap(maps, "map").attach(kView);
    await Promise.resolve();
    assert.strictEqual(viewers.length, 1);
    assert.strictEqual(viewers[0].released, false);

    rebuilt();
    await Promise.resolve();
    assert.strictEqual(viewers[0].released, true);
    resolveMap(maps, "map");
    assert.strictEqual(viewers.length, 2);
  });

  it("releases every open viewer on dispose", () => {
    const { maps, viewers } = createMaps();
    resolveMap(maps, "map").attach(kView);

    maps.dispose();

    assert.strictEqual(viewers[0].released, true);
  });
});
