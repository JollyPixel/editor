// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  VOXEL_BRUSH_PRESENCE_KEY,
  voxelMapDocumentKind
} from "@jolly-pixel/asset.voxel-map/client";
import type { ServedBackend } from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { UnknownBlockError } from "#src/assets/voxelMap/errors/UnknownBlockError.ts";
import type { VoxelMapAsset } from "#src/assets/voxelMap/VoxelMapAsset.ts";
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kGround = {
  min: {
    x: 0,
    y: 0,
    z: 0
  },
  max: {
    x: 3,
    y: 1,
    z: 2
  }
};

async function defineBlock(
  golem: Golem,
  blocksetId: string,
  name = "stone"
): Promise<void> {
  const blockset = await golem.open(blocksetId, "blockset");
  await blockset.apply([
    {
      action: "block-defined",
      block: {
        id: 1,
        name,
        shapeId: "cube",
        faceTextures: {},
        collidable: true,
        properties: {}
      }
    }
  ]);
  await blockset.settled();
}

async function createField(
  golem: Golem
): Promise<VoxelMapAsset> {
  const mapId = await golem.catalog.create("maps/field.voxelmap.json", null);
  const map = await golem.open(mapId, "voxelmap");
  const [blockset] = (await map.summary()).blocksets;
  assert.ok(blockset.assetId !== null);
  await defineBlock(golem, blockset.assetId);
  await map.addLayer("Ground");
  await map.settled();

  return map;
}

function rocksBlockset(
  assetId: string
) {
  return {
    action: "blockset-added",
    blockset: {
      id: "rocks",
      slot: 1,
      asset: {
        id: assetId,
        kind: "blockset"
      }
    }
  };
}

function openIds(
  golem: Golem
): string[] {
  return golem.status().assets.map(({ assetId }) => assetId);
}

async function connectBuilder(
  backend: ServedBackend
): Promise<Golem> {
  const bob = await registered(backend, "Bob");

  return Golem.connect({
    url: backend.url,
    token: (await createAgentToken(backend, bob, "Builder")).value
  });
}

describe("VoxelMapAsset", { timeout: 10_000 }, () => {
  test("fills and clears boxes a watching person sees, with the golem's brush", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const map = await createField(golem);
    using person = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: (await createAgentToken(backend, bob, "Watcher")).value,
      assetId: map.id,
      documentKind: voxelMapDocumentKind()
    });

    assert.equal(await map.fillBox(kGround, "stone", { layer: "Ground" }), 24);
    assert.equal(await map.clearBox({
      min: { x: 0, y: 1, z: 0 },
      max: { x: 9, y: 9, z: 0 }
    }, { layer: "Ground" }), 4);
    await map.settled();
    await person.until(() => person.synced.voxels.world.voxelCount === 20 &&
      person.peerNamed("Builder")?.presence[VOXEL_BRUSH_PRESENCE_KEY] !== undefined);

    assert.deepEqual(map.heightmap({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 5, z: 1 }
    }).heights, [[0, 0], [1, 1]]);
    assert.deepEqual(map.query({
      min: { x: 3, y: 1, z: 2 },
      max: { x: 4, y: 1, z: 2 }
    }), {
      cells: [{ x: 3, y: 1, z: 2, block: 1, layer: "Ground" }],
      truncated: false
    });
    assert.deepEqual(person.peerNamed("Builder")?.presence, {
      [VOXEL_BRUSH_PRESENCE_KEY]: {
        position: { x: 3, y: 1, z: 0 },
        size: 1,
        pattern: "square"
      }
    });
  });

  test("names blocks across blocksets added after opening, and rejects an ambiguous name", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const map = await createField(golem);
    const rocksId = await golem.catalog.create("blocksets/rocks.blockset.json", null);
    await defineBlock(golem, rocksId);
    await map.apply([
      {
        action: "blockset-added",
        blockset: {
          id: "rocks",
          slot: 1,
          asset: {
            id: rocksId,
            kind: "blockset"
          }
        }
      }
    ]);
    await map.settled();

    await assert.rejects(
      map.fillBox(kGround, "stone", { layer: "Ground" }),
      (error: unknown) => error instanceof UnknownBlockError && error.candidates.length === 2
    );
    await assert.rejects(
      map.fillBox(kGround, "rocks/stone", { layer: "Sky" }),
      /no layer "Sky"/
    );
    await map.fillBox(kGround, "rocks/stone", { layer: "Ground" });
    await map.settled();

    assert.deepEqual(
      new Set(map.query(kGround).cells.map(({ block }) => block)),
      new Set([(await map.summary()).blocks.find(({ blockset }) => blockset === "rocks")?.id])
    );
  });

  test("relinks a blockset pointed at another asset", async() => {
    await using backend = await serveStudio();
    using golem = await connectBuilder(backend);
    const map = await createField(golem);
    const rocksId = await golem.catalog.create("blocksets/rocks.blockset.json", null);
    const gravelId = await golem.catalog.create("blocksets/gravel.blockset.json", null);
    await defineBlock(golem, rocksId, "stone");
    await defineBlock(golem, gravelId, "gravel");
    await map.apply([rocksBlockset(rocksId)]);
    await map.settled();
    await map.summary();

    await map.apply([
      {
        action: "blockset-removed",
        blocksetId: "rocks"
      },
      rocksBlockset(gravelId)
    ]);
    await map.settled();
    await map.fillBox(kGround, "rocks/gravel", { layer: "Ground" });
    await map.settled();

    const { blocksets } = await map.summary();
    assert.deepEqual(
      blocksets.find(({ id }) => id === "rocks"),
      {
        id: "rocks",
        slot: 1,
        assetId: gravelId,
        linked: true
      }
    );
  });

  test("adds layers on top or right above another, numbering a taken name", async() => {
    await using backend = await serveStudio();
    using golem = await connectBuilder(backend);
    const map = await createField(golem);

    await map.addLayer("Sky");
    const decor = await map.addLayer("Ground", { above: "Ground" });
    await map.settled();

    assert.equal(decor.name, "Ground (1)");
    assert.deepEqual(
      (await map.summary()).layers.map(({ id, name }) => [id === decor.id, name]),
      [[false, "Sky"], [true, "Ground (1)"], [false, "Ground"]]
    );
  });

  test("keeps a blockset open while the agent or a map still holds it", async() => {
    await using backend = await serveStudio();
    using golem = await connectBuilder(backend);
    const map = await createField(golem);
    const [{ assetId: blocksetId }] = (await map.summary()).blocksets;
    assert.ok(blocksetId !== null);

    golem.close(blocksetId);
    assert.deepEqual(openIds(golem), [map.id, blocksetId]);
    golem.close(map.id);
    assert.deepEqual(openIds(golem), []);

    const reopened = await golem.open(map.id, "voxelmap");
    await golem.open(blocksetId, "blockset");
    golem.close(reopened.id);
    assert.deepEqual(openIds(golem), [blocksetId]);
  });
});
