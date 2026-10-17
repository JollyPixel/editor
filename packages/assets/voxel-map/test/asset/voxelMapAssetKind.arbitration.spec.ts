// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type AssetLiveProtocol } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  VOXEL_MAP_KIND,
  blocksetAsset,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";
import type { VoxelMapNetworkCommand } from "../../src/network/server.ts";
import { voxelSetCmd, worldReplaceCmd } from "../helpers/networkCommands.ts";

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

describe("voxelMapAssetKind", () => {
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

  test("a blockset link the server folded at another slot broadcasts a snapshot", () => {
    const { protocol, state } = live();
    const header = {
      seq: 1,
      timestamp: 1000
    };
    const first: VoxelMapNetworkCommand = {
      ...header,
      clientId: "alice",
      action: "blockset-added",
      blockset: { id: "grass", slot: 0, asset: blocksetAsset("asset-grass") }
    };
    const second: VoxelMapNetworkCommand = {
      ...header,
      clientId: "bob",
      action: "blockset-added",
      blockset: { id: "stone", slot: 0, asset: blocksetAsset("asset-stone") }
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
