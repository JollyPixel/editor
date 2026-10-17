// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VOXEL_LAYER_COMMAND_ACTIONS,
  VOXEL_TEMPLATE_COMMAND_ACTIONS
} from "../../../src/document/commands/index.ts";
import { makePeers, readState } from "../../helpers/roundTrip/peers.ts";
import { LAYER_CASES } from "../../helpers/roundTrip/layerCases.ts";
import { OBJECT_AND_TEMPLATE_CASES } from "../../helpers/roundTrip/objectCases.ts";

// CONSTANTS
const kCases = [...LAYER_CASES, ...OBJECT_AND_TEMPLATE_CASES];

describe("command round-trip", () => {
  for (const { name, seed, act, actions, check } of kCases) {
    it(name, () => {
      const { local, remote, commands } = makePeers(seed);
      const before = readState(remote);

      act(local);
      for (const command of commands) {
        remote.applyCommand(command);
      }

      assert.deepEqual(commands.map(({ action }) => action), actions);
      assert.notDeepEqual(readState(remote), before);
      assert.deepEqual(readState(remote), readState(local));
      check?.(remote);
    });
  }

  it("covers every layer and template command action", () => {
    const covered = new Set<string>(kCases.flatMap(({ actions }) => actions));

    assert.deepEqual(
      [...VOXEL_LAYER_COMMAND_ACTIONS, ...VOXEL_TEMPLATE_COMMAND_ACTIONS]
        .filter((action) => !covered.has(action)),
      []
    );
  });

  it("drops a late voxel command aimed at a merged-away layer", () => {
    const { local, remote, commands } = makePeers((world) => {
      world.addLayer("Target");
      world.addLayer("Source");
    });

    const sourceId = local.getLayer("Source")!.id;
    local.mergeLayer("Source", "Target");
    for (const command of commands) {
      remote.applyCommand(command);
    }
    remote.applyCommand({
      action: "voxels-set",
      layerId: sourceId,
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 4 }] }
    });

    assert.deepEqual(readState(remote), readState(local));
  });
});
