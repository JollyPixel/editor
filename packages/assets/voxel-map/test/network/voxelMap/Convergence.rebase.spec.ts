// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  rankBetween,
  VoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { voxelMapAssetKind, type VoxelMapState } from "../../../src/index.ts";
import { VoxelSyncClient } from "../../../src/network/client.ts";
import type { VoxelMapNetworkCommand } from "../../../src/network/voxelMap/types.ts";
import { createMockRoom } from "../../helpers/room.ts";
import { mapHistory, MAP_SCOPE } from "../../helpers/history.ts";
import { makeAddedCommand } from "../../helpers/networkCommands.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

function layerNames(
  document: { world: { getLayers(): readonly { name: string; }[]; }; }
): string[] {
  return document.world.getLayers().map((layer) => layer.name);
}

function readWorld(
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

async function setup() {
  const server = new LiveAssetRoom(voxelMapAssetKind({ chunkSize: 16 }));
  for (const [index, name] of ["L3", "L2", "L1"].entries()) {
    await server.receive("A", {
      ...makeAddedCommand(name),
      ...header("A", index + 1)
    });
  }

  const room = createMockRoom("B");
  const document = new VoxelDocument({ chunkSize: 16 });
  const { edits } = new VoxelSyncClient({
    room,
    document
  });

  function deliver(): void {
    for (const message of server.take<VoxelWorldJSON>("B")) {
      room.deliver(message);
    }
  }

  await server.connect("B");
  deliver();

  return {
    server,
    room,
    document,
    edits,
    deliver,
    async flush(): Promise<void> {
      for (const sent of room.sentCommands.splice(0)) {
        await server.receive("B", sent);
      }
      for (; room.resyncs > 0; room.resyncs--) {
        await server.resync("B");
      }
    }
  };
}

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

describe("voxel-map convergence", () => {
  test(
    "an undo carries the version of its step, so the server refuses it over a newer peer write",
    async() => {
      const { server, document, edits, deliver, flush } = await setup();
      const history = mapHistory(edits);

      document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
      await flush();
      deliver();
      await server.receive("A", peerPatch(server.state, "L1", 5));
      history.undo(MAP_SCOPE);
      await flush();
      deliver();

      assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 5);
      assert.deepStrictEqual(readWorld(document), readWorld(server.state));
      assert.deepStrictEqual(history.state(MAP_SCOPE).refused, [
        { label: "Edit voxels", refused: { reason: "server" } }
      ]);
    }
  );

  test("a pending new layer is rebased under a remote layer move", async() => {
    const { server, room, document, deliver, flush } = await setup();

    document.world.addLayer("L4");
    await server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    await flush();
    deliver();

    assert.strictEqual(room.resyncs, 0);
    assert.deepStrictEqual(layerNames(document).slice(2), ["L1", "L2"]);
    assert.deepStrictEqual(readWorld(document), readWorld(server.state));
  });

  test("a pending command without an inverse resyncs, then converges", async() => {
    const { server, room, document, deliver, flush } = await setup();

    document.world.mergeLayer("L1", "L2");
    await server.receive("A", moveToTop(server.state, "L3"));
    deliver();
    assert.strictEqual(room.resyncs, 1);

    await flush();
    deliver();

    assert.deepStrictEqual(readWorld(document), readWorld(server.state));
    assert.deepStrictEqual(layerNames(document), ["L3", "L2"]);
  });

  test("a peer rename does not strand the author's pending strokes", async() => {
    const { server, document, deliver, flush } = await setup();

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    await server.receive("A", {
      action: "updated",
      layerId: "L1",
      metadata: { options: { name: "Floor" } },
      ...header("A", 4)
    });
    deliver();
    await flush();
    deliver();

    assert.strictEqual(server.state.world.getLayer("Floor")?.getVoxelAt(kOrigin)?.blockId, 2);
    assert.deepStrictEqual(readWorld(document), readWorld(server.state));
  });

  test("concurrent layers with one name end up with the same unique names", async() => {
    const { server, document, deliver, flush } = await setup();

    document.world.addLayer("New");
    await server.receive("A", {
      ...makeAddedCommand("peer-new"),
      metadata: { name: "New", rank: "0V", options: {} },
      ...header("A", 4)
    });
    deliver();
    await flush();
    deliver();

    assert.deepStrictEqual(
      [...layerNames(server.state)].sort(),
      ["L1", "L2", "L3", "New", "New (1)"]
    );
    assert.deepStrictEqual(readWorld(document), readWorld(server.state));
  });
});
