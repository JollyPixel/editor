// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld, type VoxelLayer } from "../../src/world/index.ts";
import type { VoxelLayerHookEvent } from "../../src/hooks.ts";
import type { VoxelObjectJSON } from "../../src/serialization/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";

interface Peers {
  local: VoxelWorld;
  remote: VoxelWorld;
  replay: () => void;
}

function makePeers(
  seed: (world: VoxelWorld) => void
): Peers {
  const local = new VoxelWorld(4);
  const remote = new VoxelWorld(4);
  seed(local);
  seed(remote);

  const recorded: VoxelLayerHookEvent[] = [];
  local.onLayerUpdated = (event) => recorded.push(event);

  return {
    local,
    remote,
    replay() {
      for (const event of recorded) {
        remote.applyRemoteCommand(event);
      }
    }
  };
}

function layersOf(
  world: VoxelWorld
): unknown[] {
  return world.getLayers().map((layer: VoxelLayer) => {
    const { id, ...rest } = layer.toJSON();

    return rest;
  });
}

function objectLayersOf(
  world: VoxelWorld
): unknown[] {
  return world.getObjectLayers().map(({ id, ...rest }) => rest);
}

function assertConverged(
  { local, remote }: Peers
): void {
  assert.deepEqual(layersOf(remote), layersOf(local));
  assert.deepEqual(objectLayersOf(remote), objectLayersOf(local));
}

function makeObject(
  id: string
): VoxelObjectJSON {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    z: 0,
    visible: true
  };
}

describe("command round-trip — cloneLayer", () => {
  it("reproduces the clone, voxels included, on the peer", () => {
    const peers = makePeers((world) => {
      world.addLayer("Bottom");
      world.addLayer("layer");
      world.setVoxelAt("layer", { x: 1, y: 2, z: 3 }, makeVoxelEntry(7, 1));
      world.setVoxelAt("layer", { x: 9, y: 0, z: 0 }, makeVoxelEntry(2, 0));
    });

    peers.local.cloneLayer("layer");
    peers.replay();

    assertConverged(peers);
    assert.deepEqual(
      peers.remote.getLayers().map((layer) => layer.name),
      ["layer (1)", "layer", "Bottom"]
    );
    assert.deepEqual(
      peers.remote.getLayer("layer (1)")?.getVoxelAt({ x: 1, y: 2, z: 3 }),
      makeVoxelEntry(7, 1)
    );
  });

  it("reproduces repeated clones under the same names", () => {
    const peers = makePeers((world) => world.addLayer("layer"));

    peers.local.cloneLayer("layer");
    peers.local.cloneLayer("layer");
    peers.replay();

    assertConverged(peers);
  });
});

describe("command round-trip — mergeLayer", () => {
  it("consumes the same source and resolves overlaps identically", () => {
    const peers = makePeers((world) => {
      world.addLayer("Target", { properties: { biome: "forest" } });
      world.addLayer("Source", { properties: { seed: 7 } });
      world.setVoxelAt("Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
      world.setVoxelAt("Source", { x: 0, y: 0, z: 0 }, makeVoxelEntry(9, 0));
      world.setVoxelAt("Source", { x: 5, y: 0, z: 0 }, makeVoxelEntry(3, 0));
    });

    peers.local.mergeLayer("Source", "Target");
    peers.replay();

    assertConverged(peers);
    assert.equal(peers.remote.getLayer("Source"), undefined);
    assert.equal(
      peers.remote.getLayer("Target")?.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId,
      9
    );
  });

  it("drops a late voxel command aimed at the consumed layer", () => {
    const peers = makePeers((world) => {
      world.addLayer("Target");
      world.addLayer("Source");
    });

    const late: VoxelLayerHookEvent = {
      action: "voxels-set",
      layerName: "Source",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 4 }] }
    };

    peers.local.mergeLayer("Source", "Target");
    peers.replay();

    assert.doesNotThrow(() => peers.remote.applyRemoteCommand(late));
    assertConverged(peers);
  });
});

describe("command round-trip — moveObjectToLayer", () => {
  it("lands the object in the same layer on the peer", () => {
    const peers = makePeers((world) => {
      world.addObjectLayer("From");
      world.addObjectLayer("To");
      world.addObjectToLayer("From", makeObject("obj1"));
      world.addObjectToLayer("From", makeObject("obj2"));
    });

    peers.local.moveObjectToLayer("From", "obj1", "To");
    peers.replay();

    assertConverged(peers);
    assert.deepEqual(
      peers.remote.getObjectLayer("To")?.objects.map((object) => object.id),
      ["obj1"]
    );
  });
});
