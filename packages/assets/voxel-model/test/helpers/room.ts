// Import Third-party Dependencies
import {
  mockAssetRoom,
  type MockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import type {
  VoxelModelNetworkCommand,
  VoxelModelSnapshot
} from "#src/network/types.ts";

export interface MockRoom extends MockAssetRoom<VoxelModelNetworkCommand, VoxelModelSnapshot> {
  deliverCommand(command: VoxelModelNetworkCommand): void;
  deliverSnapshot(snapshot: VoxelModelSnapshot): void;
}

export function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const room = mockAssetRoom<VoxelModelNetworkCommand, VoxelModelSnapshot>(clientId);

  return Object.assign(room, {
    deliverCommand: (command: VoxelModelNetworkCommand) => room.deliver({
      type: "command",
      data: command
    }),
    deliverSnapshot: (snapshot: VoxelModelSnapshot) => room.deliver({
      type: "snapshot",
      data: snapshot
    })
  });
}
