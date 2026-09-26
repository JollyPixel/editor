// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData,
  type AssetLiveProtocol
} from "@jolly-pixel/asset-server/kinds";
import { protocolEvents } from "@jolly-pixel/network";
import {
  decodeVoxelDocument,
  encodeVoxelDocument,
  VOXEL_WORLD_COMMAND_ACTIONS,
  VOXEL_WORLD_VERSION
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_EXTENSION,
  VOXEL_MAP_KIND,
  tilesetAsset,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";
import type { VoxelNetworkCommand } from "../../src/network/server.ts";
import {
  voxelSetCmd,
  worldReplaceCmd
} from "../helpers/networkCommands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

interface LiveHarness {
  protocol: AssetLiveProtocol<VoxelNetworkCommand>;
  state: VoxelMapState;
}

function live(): LiveHarness {
  const handler = voxelMapAssetKind({ chunkSize: 16 });
  const state = handler.create("asset-1");

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

function positionDelta(
  layerName: string,
  delta: { x: number; y: number; z: number; }
): VoxelNetworkCommand {
  return {
    action: "position-updated",
    layerName,
    metadata: { delta },
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };
}

describe("voxelMapAssetKind", () => {
  test("rebinds copied tileset assets without changing tileset keys", () => {
    const handler = voxelMapAssetKind();
    const state = handler.create("map");
    state.tilesets.add({
      id: "default",
      asset: tilesetAsset("original"),
      tileSize: 16
    });

    handler.rebind?.(state, new Map([["original", "copied"]]));

    assert.strictEqual(state.tilesets.defaultTilesetId, "default");
    assert.deepEqual(handler.dependencies?.(state), [
      tilesetAsset("copied")
    ]);
  });

  test("declares its kind and claims .voxelmap.json paths", () => {
    const handler = voxelMapAssetKind();

    assert.strictEqual(handler.kind, VOXEL_MAP_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [VOXEL_MAP_EXTENSION]);
    assert.strictEqual(handler.match, undefined);
  });

  test("snapshots slower than the back-end default", () => {
    assert.deepEqual(
      voxelMapAssetKind().snapshot,
      {
        delay: 5_000,
        maxDelay: 60_000
      }
    );
  });

  test("creates an empty world at the configured chunk size", () => {
    const state = voxelMapAssetKind({ chunkSize: 8 }).create("asset-1");

    assert.strictEqual(state.world.chunkSize, 8);
    assert.deepEqual(state.world.getLayers(), []);
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
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
    source.tilesets.add({
      id: "default",
      src: "textures/tileset.png",
      tileSize: 32
    });

    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(source));

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
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const source = new VoxelMapState(16);
    source.tilesets.add({
      id: "default",
      src: "textures/tileset.png",
      tileSize: 32
    });

    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(source));

    assert.deepEqual(state.toJSON().tilesets, source.tilesets.definitions());
  });

  test("a domain command mutates the folded world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
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

  test("a delta position applies exactly once per event", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    const layer = state.world.addLayer("Ground");

    foldAssetEvent(
      handler,
      state,
      event(VOXEL_MAP_COMMAND, positionDelta("Ground", {
        x: 2,
        y: 0,
        z: 0
      }))
    );

    assert.deepEqual(layer.position, {
      x: 2,
      y: 0,
      z: 0
    });
  });

  test("a world-replace command reloads the whole world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Stale");

    const replacement = new VoxelMapState(16);
    replacement.world.addLayer("Fresh");

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
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
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND
    }));

    assert.deepEqual(state.world.getLayers(), []);
    assert.strictEqual(state.tilesets.size, 0);
  });

  test("a malformed document throws before touching the world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

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

  test("a tileset link naming neither a source nor an asset is rejected", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const content = new TextEncoder().encode(JSON.stringify({
      version: VOXEL_WORLD_VERSION,
      chunkSize: 16,
      tilesets: [{ id: "terrain" }],
      layers: []
    }));

    assert.throws(
      () => handler.load(handler.create("asset-1"), content),
      {
        name: "InvalidAssetDocumentError",
        message: /\/tilesets\/0/
      }
    );
  });

  test("a command naming an unknown layer is dropped, not fatal", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");

    assert.doesNotThrow(() => {
      foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
        layerName: "Missing"
      })));
    });
  });

  test("a document saved with another chunk size loads", async() => {
    const source = new VoxelMapState(32);
    source.world.addLayer("Ground");
    source.world.setVoxelAt(
      "Ground",
      {
        x: 20,
        y: 0,
        z: -3
      },
      {
        blockId: 4,
        transform: 0
      }
    );
    const handler = voxelMapAssetKind();
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, documentEvent(source));

    assert.equal(state.world.chunkSize, 16);
    assert.equal(state.world.getVoxelAt({ x: 20, y: 0, z: -3 })?.blockId, 4);
    const saved = decodeVoxelDocument(await handler.serialize(state));
    assert.equal(saved.chunkSize, 16);
    assert.deepEqual(Object.keys(saved.layers[0].voxels), ["20,0,-3"]);
  });

  test("serialize round-trips through apply", async() => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const first = handler.create("asset-1");
    first.world.addLayer("Ground");
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

  test("declares the voxel command stream", () => {
    const { commands } = voxelMapAssetKind();

    assert.strictEqual(commands!.eventType, VOXEL_MAP_COMMAND);
    assert.deepEqual(protocolEvents(commands!.protocol).toSorted(), [
      ...VOXEL_WORLD_COMMAND_ACTIONS,
      "world-replace"
    ].toSorted());
  });

  test("ignores a command payload the protocol rejects", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

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

  test("a committed arbitration rejects the older write", () => {
    const { protocol } = live();

    protocol.arbitrate(
      voxelSetCmd({ timestamp: 2_000, clientId: "alice" })
    )!.commit!();

    assert.strictEqual(
      protocol.arbitrate(
        voxelSetCmd({ timestamp: 1_000, clientId: "bob" })
      ),
      null
    );
  });

  test("world-replace skips arbitration and broadcasts a snapshot", () => {
    const { protocol, state } = live();
    const command = worldReplaceCmd();

    const arbitration = protocol.arbitrate(command);
    assert.notStrictEqual(arbitration, null);

    assert.deepEqual(
      protocol.broadcast!(arbitration!.command),
      {
        type: "snapshot",
        data: state.toJSON()
      }
    );
  });

  test("any other command broadcasts itself", () => {
    const { protocol } = live();
    const command = voxelSetCmd({});

    assert.deepEqual(
      protocol.broadcast!(command),
      {
        type: "command",
        data: command
      }
    );
  });

  test("a tileset link the server folded at another slot broadcasts a snapshot", () => {
    const { protocol, state } = live();
    const header = {
      seq: 1,
      timestamp: 1000
    };
    const first: VoxelNetworkCommand = {
      ...header,
      clientId: "alice",
      action: "tileset-added",
      tileset: { id: "grass", slot: 0, asset: tilesetAsset("asset-grass") }
    };
    const second: VoxelNetworkCommand = {
      ...header,
      clientId: "bob",
      action: "tileset-added",
      tileset: { id: "stone", slot: 0, asset: tilesetAsset("asset-stone") }
    };
    state.applyCommand(first);
    state.applyCommand(second);

    assert.deepEqual(protocol.broadcast!(first), {
      type: "command",
      data: first
    });
    assert.deepEqual(protocol.broadcast!(second), {
      type: "snapshot",
      data: state.toJSON()
    });
  });

  test("live() gives each room its own conflict tracker", () => {
    const first = live().protocol;
    const second = live().protocol;

    first.arbitrate(
      voxelSetCmd({ timestamp: 2_000, clientId: "alice" })
    )!.commit!();

    assert.notStrictEqual(
      second.arbitrate(
        voxelSetCmd({ timestamp: 1_000, clientId: "bob" })
      ),
      null
    );
  });
});

describe("voxelMapAssetKind — tilesets", () => {
  const kHeader = {
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };

  test("a linked tileset receives a slot and survives serialization", async() => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      ...kHeader,
      action: "tileset-added",
      tileset: {
        id: "stone",
        asset: tilesetAsset("asset-stone")
      }
    }));

    const document = decodeVoxelDocument(await handler.serialize(state));

    assert.deepEqual(document.tilesets, [
      { id: "stone", slot: 0, asset: tilesetAsset("asset-stone") }
    ]);
    assert.deepEqual(handler.dependencies?.(state), [
      tilesetAsset("asset-stone")
    ]);
  });

  test("a block command is not part of the map stream", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.addLayer("Ground");

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      ...kHeader,
      action: "block-defined",
      block: makeBlockDef(3, "cube")
    }));
    foldAssetEvent(
      handler,
      state,
      event(VOXEL_MAP_COMMAND, voxelSetCmd({ blockId: 3, seq: 2 }))
    );

    assert.strictEqual(state.world.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 3);
    assert.strictEqual("blocks" in state, false);
  });
});
