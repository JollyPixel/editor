// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  encodeContent,
  type AssetEventData
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  voxelMapAssetHandler,
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND
} from "../../src/asset/voxelMapAssetHandler.ts";
import {
  createVoxelMapState,
  encodeVoxelMapDocument,
  voxelMapSnapshot
} from "../../src/asset/VoxelMapDocument.ts";
import type { VoxelMapState } from "../../src/asset/VoxelMapState.ts";
import type { VoxelNetworkCommand } from "../../src/network/types.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";

function event(
  eventType: string,
  eventData: AssetEventData | VoxelNetworkCommand | unknown
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
  const data = encodeVoxelMapDocument(state);

  return event(ASSET_CREATED, {
    path: "world.voxelmap.json",
    kind: VOXEL_MAP_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

function offsetDelta(
  layerName: string,
  delta: { x: number; y: number; z: number; }
): VoxelNetworkCommand {
  return {
    action: "offset-updated",
    layerName,
    metadata: { delta },
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };
}

describe("voxelMapAssetHandler", () => {
  test("declares its kind and claims .voxelmap.json paths", () => {
    const handler = voxelMapAssetHandler();

    assert.strictEqual(handler.kind, VOXEL_MAP_KIND);
    assert.deepEqual(handler.match, ["**/*.voxelmap.json"]);
  });

  test("snapshots slower than the back-end default", () => {
    assert.deepEqual(
      voxelMapAssetHandler().snapshot,
      {
        delay: 5_000,
        maxDelay: 60_000
      }
    );
  });

  test("creates an empty world at the configured chunk size", () => {
    const state = voxelMapAssetHandler({ chunkSize: 8 }).create("asset-1");

    assert.strictEqual(state.world.chunkSize, 8);
    assert.deepEqual(state.world.getLayers(), []);
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const source = createVoxelMapState(16);
    source.world.addLayer("Ground");
    source.world.setVoxelAt(
      "Ground",
      {
        x: 1,
        y: 2,
        z: 3
      },
      {
        blockId: 7,
        transform: 0
      }
    );
    source.tilesets = [
      {
        id: "default",
        src: "textures/tileset.png",
        tileSize: 32
      }
    ];

    const state = handler.create("asset-1");
    handler.apply(state, documentEvent(source));

    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Ground"]
    );
    assert.strictEqual(
      state.world.getVoxelAt({ x: 1, y: 2, z: 3 })?.blockId,
      7
    );
  });

  test("keeps the tileset list a document arrived with", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const source = createVoxelMapState(16);
    source.tilesets = [
      {
        id: "default",
        src: "textures/tileset.png",
        tileSize: 32
      }
    ];

    const state = handler.create("asset-1");
    handler.apply(state, documentEvent(source));

    assert.deepEqual(voxelMapSnapshot(state).tilesets, source.tilesets);
  });

  test("a domain command mutates the folded world", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    handler.apply(state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
      x: 1,
      y: 0,
      z: 1,
      blockId: 3
    })));

    assert.strictEqual(
      state.world.getVoxelAt({ x: 1, y: 0, z: 1 })?.blockId,
      3
    );
  });

  test("a delta offset applies exactly once per event", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    const layer = state.world.addLayer("Ground");

    handler.apply(
      state,
      event(VOXEL_MAP_COMMAND, offsetDelta("Ground", {
        x: 2,
        y: 0,
        z: 0
      }))
    );

    // Applying the command twice would move x to 4.
    // The expected value verifies single application.
    assert.deepEqual(layer.offset, {
      x: 2,
      y: 0,
      z: 0
    });
  });

  test("a world-replace command reloads the whole world", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Stale");

    const replacement = createVoxelMapState(16);
    replacement.world.addLayer("Fresh");

    handler.apply(state, event(VOXEL_MAP_COMMAND, {
      action: "world-replace",
      data: voxelMapSnapshot(replacement),
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }));

    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Fresh"]
    );
  });

  test("a delete empties the world", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    handler.apply(state, event(ASSET_DELETED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND
    }));

    assert.deepEqual(state.world.getLayers(), []);
    assert.deepEqual(state.tilesets, []);
  });

  test("a malformed event never throws and keeps the last good world", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    assert.doesNotThrow(() => {
      handler.apply(state, event(ASSET_CREATED, {
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

  test("a command naming an unknown layer is dropped, not fatal", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");

    assert.doesNotThrow(() => {
      handler.apply(state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
        layerName: "Missing"
      })));
    });
  });

  test("a document with a mismatched chunk size is refused", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    handler.apply(state, documentEvent(createVoxelMapState(8)));

    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Ground"]
    );
  });

  test("serialize round-trips through apply", async() => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const first = handler.create("asset-1");
    first.world.addLayer("Ground");
    handler.apply(first, event(VOXEL_MAP_COMMAND, voxelSetCmd({
      x: 4,
      y: 1,
      z: 4,
      blockId: 9
    })));

    const data = await handler.serialize(first);
    const second = handler.create("asset-1");
    handler.apply(second, event(ASSET_CREATED, {
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

  test("createExtension binds the room id and the kind", () => {
    const handler = voxelMapAssetHandler();
    const state = handler.create("asset-1");
    const extension = handler.createExtension!({
      assetId: "asset-1",
      kind: VOXEL_MAP_KIND,
      roomId: `${VOXEL_MAP_KIND}:asset-1`,
      state
    });

    assert.strictEqual(extension.id, `${VOXEL_MAP_KIND}:asset-1`);
    assert.strictEqual(extension.name, VOXEL_MAP_KIND);
  });
});
