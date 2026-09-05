// Import Node.js Dependencies
import { describe, test } from "node:test";
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
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND,
  voxelMapAssetHandler,
  VoxelMapState
} from "../../src/asset/index.ts";
import { decodeVoxelDocument, encodeVoxelDocument } from "../../src/serialization/index.ts";
import { resolveBlockDefinition } from "../../src/blocks/index.ts";
import type { VoxelNetworkCommand } from "../../src/network/index.ts";
import { blockDefinedCmd, voxelSetCmd } from "../helpers/networkCommands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

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
  const data = encodeVoxelDocument(state.toJSON());

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
    const source = new VoxelMapState(16);
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
    const source = new VoxelMapState(16);
    source.tilesets = [
      {
        id: "default",
        src: "textures/tileset.png",
        tileSize: 32
      }
    ];

    const state = handler.create("asset-1");
    handler.apply(state, documentEvent(source));

    assert.deepEqual(state.toJSON().tilesets, source.tilesets);
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

    const replacement = new VoxelMapState(16);
    replacement.world.addLayer("Fresh");

    handler.apply(state, event(VOXEL_MAP_COMMAND, {
      action: "world-replace",
      data: replacement.toJSON(),
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

    handler.apply(state, documentEvent(new VoxelMapState(8)));

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

describe("voxelMapAssetHandler — block definitions", () => {
  test("a block command survives serialization, so a shape edit outlives the server", async() => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");

    handler.apply(state, documentEvent(new VoxelMapState(16)));
    handler.apply(
      state,
      event(
        VOXEL_MAP_COMMAND,
        blockDefinedCmd({
          id: 3,
          shapeId: "slope"
        })
      )
    );

    const document = decodeVoxelDocument(await handler.serialize(state));

    assert.deepEqual(
      document.blocks?.map((block) => [block.id, block.shapeId]),
      [[3, "slope"]]
    );
  });

  test("replaying the serialized document restores the block table", async() => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const source = handler.create("asset-1");
    source.blocks.register(makeBlockDef(3, "slope"));

    const restored = handler.create("asset-1");
    handler.apply(restored, documentEvent(source));

    assert.strictEqual(restored.blocks.get(3)?.shapeId, "slope");
  });

  test("a later definition of the same id replaces the earlier one", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");

    handler.apply(
      state,
      event(VOXEL_MAP_COMMAND, blockDefinedCmd({ id: 3, shapeId: "cube" }))
    );
    handler.apply(
      state,
      event(VOXEL_MAP_COMMAND, blockDefinedCmd({ id: 3, shapeId: "slope" }))
    );

    assert.strictEqual(state.blocks.get(3)?.shapeId, "slope");
  });

  test("a block-removed command drops the definition", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");

    handler.apply(
      state,
      event(VOXEL_MAP_COMMAND, blockDefinedCmd({ id: 3 }))
    );
    handler.apply(
      state,
      event(VOXEL_MAP_COMMAND, {
        action: "block-removed",
        blockId: 3,
        clientId: "client-A",
        seq: 2,
        timestamp: 2000
      })
    );

    assert.strictEqual(state.blocks.has(3), false);
  });

  test("a document load replaces the block table rather than merging into it", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.blocks.register(makeBlockDef(9, "cube"));

    const source = new VoxelMapState(16);
    source.blocks.register(
      resolveBlockDefinition(makeBlockDef(3, "slope"))
    );
    handler.apply(state, documentEvent(source));

    assert.strictEqual(state.blocks.has(9), false);
    assert.strictEqual(state.blocks.get(3)?.shapeId, "slope");
  });

  test("a delete clears the block table", () => {
    const handler = voxelMapAssetHandler({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.blocks.register(makeBlockDef(3, "slope"));

    handler.apply(state, event(ASSET_DELETED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND
    }));

    assert.deepEqual([...state.blocks.getAll()], []);
  });
});
