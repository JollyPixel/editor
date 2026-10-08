// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { HistoryStepInfo } from "@jolly-pixel/history";
import {
  rankBetween,
  VoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  voxelMapAssetKind,
  type VoxelMapState
} from "../../src/index.ts";
import { VoxelSyncClient } from "../../src/network/client.ts";
import type {
  VoxelMapNetworkCommand,
  VoxelMapServerMessage
} from "../../src/network/types.ts";
import { makeAddedCommand } from "../helpers/networkCommands.ts";
import { LiveRoom } from "../helpers/liveRoom.ts";
import { createMockRoom } from "../helpers/room.ts";
import {
  mapHistory,
  MAP_SCOPE
} from "../helpers/history.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

function header(
  clientId: string,
  seq: number
) {
  return {
    clientId,
    seq,
    timestamp: seq
  };
}

function layerNames(
  document: { world: { getLayers(): readonly { name: string; }[]; }; }
): string[] {
  return document.world.getLayers().map((layer) => layer.name);
}

function worldOf(
  target: { save?: () => VoxelWorldJSON; toJSON?: () => VoxelWorldJSON; }
): unknown {
  const json = target.save?.() ?? target.toJSON!();

  return json.layers;
}

function moveToTop(
  state: VoxelMapState,
  layerId: string
): VoxelMapNetworkCommand {
  return {
    action: "layer-moved",
    layerId,
    metadata: { rank: rankBetween(state.world.getLayers()[0].rank, null) },
    ...header("A", 4)
  };
}

function peerPatch(
  state: VoxelMapState,
  layerName: string,
  blockId: number
): VoxelMapNetworkCommand {
  return {
    action: "voxels-patched",
    layerId: state.world.getLayer(layerName)!.id,
    metadata: { cells: [kOrigin.x, kOrigin.y, kOrigin.z, blockId, 0] },
    ...header("A", 4)
  };
}

function setup() {
  const server = new LiveRoom<VoxelMapState, VoxelMapNetworkCommand>(
    voxelMapAssetKind({ chunkSize: 16 })
  );
  ["L3", "L2", "L1"].forEach((name, index) => server.receive("A", {
    ...makeAddedCommand(name),
    ...header("A", index + 1)
  }));

  const room = createMockRoom("B");
  const document = new VoxelDocument({ chunkSize: 16 });
  const { edits } = new VoxelSyncClient({
    room,
    document
  });

  function deliver(): void {
    for (const message of server.take("B")) {
      room.deliver(message as VoxelMapServerMessage);
    }
  }

  server.connect("B");
  deliver();

  return {
    server,
    room,
    document,
    edits,
    deliver,
    flush(): void {
      for (const sent of room.sentCommands.splice(0)) {
        server.receive("B", sent);
      }
      for (; room.resyncs > 0; room.resyncs--) {
        server.resync("B");
      }
    }
  };
}

describe("voxel-map convergence", () => {
  test("C2: concurrent layer moves leave the author in the server's order", () => {
    const { server, document, deliver, flush } = setup();
    assert.deepStrictEqual(layerNames(document), ["L1", "L2", "L3"]);

    document.world.moveLayerTo("L2", 0);
    server.receive("A", moveToTop(server.state, "L3"));
    flush();
    deliver();

    assert.deepStrictEqual(layerNames(server.state), ["L3", "L2", "L1"]);
    assert.deepStrictEqual(layerNames(document), layerNames(server.state));
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a newer local voxel write survives an older peer write to the same cell", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 200 });
    const { server, document, deliver, flush } = setup();

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    server.receive("A", {
      action: "voxel-set",
      layerId: "L1",
      metadata: {
        position: kOrigin,
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        flipZ: false
      },
      ...header("A", 4)
    });
    flush();
    deliver();

    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 2);
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a voxel replay the server refuses is corrected, not resynced", () => {
    const { server, room, document, deliver } = setup();
    server.receive("A", {
      action: "voxel-set",
      layerId: "L1",
      metadata: {
        position: kOrigin,
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        flipZ: false
      },
      ...header("A", 4)
    });
    deliver();
    const received: string[] = [];
    room.on("message", (message) => received.push(message.type));

    server.receive("B", {
      action: "voxels-removed",
      layerId: "L1",
      metadata: { entries: [{ position: kOrigin }] },
      clientId: "B",
      seq: 1,
      timestamp: 0,
      basis: 3
    });
    deliver();

    assert.deepStrictEqual(received, ["correction"]);
    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 1);
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a remote layer move is applied under pending voxel writes", () => {
    const { server, document, deliver, flush } = setup();

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    document.world.removeVoxel("L1", { position: kOrigin });
    document.world.setVoxel("L2", { position: kOrigin, blockId: 3 });
    server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    assert.deepStrictEqual(layerNames(document), ["L3", "L1", "L2"]);

    flush();
    deliver();

    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a pending undo is rebased with the inverse of its own writes", () => {
    const { server, room, document, edits, deliver, flush } = setup();
    const history = mapHistory(edits);

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    history.undo(MAP_SCOPE);
    server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    assert.strictEqual(room.resyncs, 0);
    assert.strictEqual(document.world.getVoxelAt(kOrigin), undefined);

    flush();
    deliver();

    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a peer write landing after the server confirmed an edit refuses its step", () => {
    const { server, document, edits, deliver, flush } = setup();
    const history = mapHistory(edits);
    const refused: HistoryStepInfo[] = [];
    history.on("refused", (_scope, step) => refused.push(step));

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    flush();
    deliver();
    server.receive("A", peerPatch(server.state, "L1", 5));
    deliver();

    assert.deepStrictEqual(refused, [
      { label: "Edit voxels", refused: { reason: "peer", clientId: "A" } }
    ]);
  });

  test("an undo carries the version of its step, so the server refuses it over a newer peer write", () => {
    const { server, document, edits, deliver, flush } = setup();
    const history = mapHistory(edits);

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    flush();
    deliver();
    server.receive("A", peerPatch(server.state, "L1", 5));
    history.undo(MAP_SCOPE);
    flush();
    deliver();

    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 5);
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
    assert.deepStrictEqual(history.state(MAP_SCOPE).refused, [
      { label: "Edit voxels", refused: { reason: "server" } }
    ]);
  });

  test("a pending new layer is rebased under a remote layer move", () => {
    const { server, room, document, deliver, flush } = setup();

    document.world.addLayer("L4");
    server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    flush();
    deliver();

    assert.strictEqual(room.resyncs, 0);
    assert.deepStrictEqual(layerNames(document).slice(2), ["L1", "L2"]);
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("a pending command without an inverse resyncs, then converges", () => {
    const { server, room, document, deliver, flush } = setup();

    document.world.mergeLayer("L1", "L2");
    server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    assert.strictEqual(room.resyncs, 1);

    flush();
    deliver();

    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
    assert.deepStrictEqual(layerNames(document), ["L3", "L2"]);
  });

  test("a peer rename does not strand the author's pending strokes", () => {
    const { server, document, deliver, flush } = setup();

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    server.receive("A", {
      action: "updated",
      layerId: "L1",
      metadata: { options: { name: "Floor" } },
      ...header("A", 4)
    });
    deliver();
    flush();
    deliver();

    assert.strictEqual(server.state.world.getLayer("Floor")?.getVoxelAt(kOrigin)?.blockId, 2);
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });

  test("concurrent layers with one name end up with the same unique names", () => {
    const { server, document, deliver, flush } = setup();

    document.world.addLayer("New");
    server.receive("A", {
      ...makeAddedCommand("peer-new"),
      metadata: { name: "New", rank: "0V", options: {} },
      ...header("A", 4)
    });
    deliver();
    flush();
    deliver();

    assert.deepStrictEqual(
      [...layerNames(server.state)].sort(),
      ["L1", "L2", "L3", "New", "New (1)"]
    );
    assert.deepStrictEqual(worldOf(document), worldOf(server.state));
  });
});
