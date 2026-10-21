// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData,
  type AssetLiveProtocol
} from "@jolly-pixel/asset-server";
import {
  decodeVoxelWorld,
  encodeVoxelWorld,
  VOXEL_WORLD_VERSION,
  VOXEL_WORLD_COMMAND_ACTIONS
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";
import type { VoxelMapNetworkCommand } from "../../src/network/server.ts";
import { templateCommands, voxelSetCmd } from "../helpers/networkCommands.ts";

interface LiveHarness {
  protocol: AssetLiveProtocol<VoxelMapNetworkCommand>;
  state: VoxelMapState;
}

function live(): LiveHarness {
  const handler = voxelMapAssetKind({ chunkSize: 16 });
  const state = handler.create("asset-1");
  state.world.restoreLayer({ id: "Ground", name: "Ground" });

  return {
    state,
    protocol: handler.commands!.live!({
      assetId: "asset-1",
      kind: VOXEL_MAP_KIND,
      roomId: `${VOXEL_MAP_KIND}:asset-1`,
      state
    })
  };
}

function event(
  eventType: string,
  eventData: AssetEventData | VoxelMapNetworkCommand | unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: VOXEL_MAP_KIND,
    assetId: "asset-1",
    eventType,
    eventData,
    eventVersion: 1,
    actor: {
      type: "user",
      id: "u1"
    },
    createdAt: new Date().toISOString()
  } as EventStore.Event;
}

function documentEvent(
  state: VoxelMapState
): EventStore.Event {
  const data = encodeVoxelWorld(state.toJSON());

  return event(ASSET_CREATED, {
    path: "world.voxelmap.json",
    kind: VOXEL_MAP_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

describe("voxelMapAssetKind", () => {
  test("a malformed document throws before touching the world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Ground", name: "Ground" });

    assert.throws(() => {
      foldAssetEvent(handler, state, event(ASSET_CREATED, {
        path: "world.voxelmap.json",
        kind: VOXEL_MAP_KIND,
        hash: "h1",
        size: 2,
        content: encodeContent(new TextEncoder().encode("{{"))
      }));
    });
    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Ground"]
    );
  });

  test("a blockset link naming neither a source nor an asset is rejected", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const content = new TextEncoder().encode(JSON.stringify({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      blocksets: [{ id: "terrain" }],
      layers: []
    }));

    assert.throws(
      () => handler.load(handler.create("asset-1"), content),
      {
        name: "InvalidAssetFileError",
        message: /\/blocksets\/0/
      }
    );
  });

  test("a command naming an unknown layer is dropped, not fatal", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");

    assert.doesNotThrow(() => {
      foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
        layerId: "Missing"
      })));
    });
  });

  test("a document saved with another chunk size loads", async() => {
    const source = new VoxelMapState(32);
    source.world.restoreLayer({ id: "Ground", name: "Ground" });
    source.world.setVoxel("Ground", {
      position: { x: 20, y: 0, z: -3 },
      blockId: 4
    });
    const handler = voxelMapAssetKind();
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, documentEvent(source));

    assert.equal(state.world.chunkSize, 16);
    assert.equal(state.world.getVoxelAt({ x: 20, y: 0, z: -3 })?.blockId, 4);
    const saved = decodeVoxelWorld(await handler.serialize(state));
    assert.equal(saved.chunkSize, 16);
    assert.deepEqual(saved.layers[0].chunks.map(({ at }) => at), [[1, 0, -1]]);
  });

  test("serialize round-trips through apply", async() => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const first = handler.create("asset-1");
    first.world.restoreLayer({ id: "Ground", name: "Ground" });
    foldAssetEvent(handler, first, event(VOXEL_MAP_COMMAND, voxelSetCmd({
      x: 4,
      y: 1,
      z: 4,
      blockId: 9
    })));

    const data = await handler.serialize(first);
    const second = handler.create("asset-1");
    foldAssetEvent(handler, second, event(ASSET_CREATED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND,
      hash: "h1",
      size: data.byteLength,
      content: encodeContent(data)
    }));

    assert.strictEqual(
      second.world.getVoxelAt({ x: 4, y: 1, z: 4 })?.blockId,
      9
    );
  });

  test("a folded template survives serialization", async() => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const first = handler.create("asset-1");
    const [defined] = templateCommands();
    foldAssetEvent(handler, first, event(VOXEL_MAP_COMMAND, {
      ...defined,
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }));

    const data = await handler.serialize(first);
    const second = handler.create("asset-1");
    foldAssetEvent(handler, second, event(ASSET_CREATED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND,
      hash: "h1",
      size: data.byteLength,
      content: encodeContent(data)
    }));

    const template = second.world.templates.get("pair");
    assert.strictEqual(template?.name, "Pair");
    assert.strictEqual(template?.voxelCount, 2);
  });

  test("declares the voxel command stream", () => {
    const { commands } = voxelMapAssetKind();

    assert.strictEqual(commands!.eventType, VOXEL_MAP_COMMAND);
    assert.deepEqual(commands!.protocol.events.toSorted(), [
      ...VOXEL_WORLD_COMMAND_ACTIONS,
      "world-replace"
    ].toSorted());
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Ground", name: "Ground" });

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      ...voxelSetCmd({ blockId: 9 }),
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: "9"
      }
    }));
    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, null));
    assert.strictEqual(state.world.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);

    foldAssetEvent(
      handler,
      state,
      event(VOXEL_MAP_COMMAND, voxelSetCmd({ blockId: 9 }))
    );
    assert.strictEqual(state.world.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 9);
  });

  test("an uncommitted arbitration leaves the tracker untouched", () => {
    const { protocol } = live();

    protocol.arbitrate(
      voxelSetCmd({ timestamp: 2_000, clientId: "alice" })
    );

    assert.notStrictEqual(
      protocol.arbitrate(
        voxelSetCmd({ timestamp: 1_000, clientId: "bob" })
      ),
      null
    );
  });
});
