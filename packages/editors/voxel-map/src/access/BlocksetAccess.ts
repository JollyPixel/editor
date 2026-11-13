// Import Third-party Dependencies
import {
  BLOCKSET_CAPABILITIES,
  type BlocksetDocumentNetworkCommand
} from "@jolly-pixel/asset.voxel-map/client";
import {
  CapabilityTable,
  type CapabilityName,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type BlocksetAction = BlocksetDocumentNetworkCommand["action"];
export type BlocksetCapability = CapabilityName<typeof BLOCKSET_CAPABILITIES>;

export type BlocksetAccess = Grants<BlocksetCapability>;
export type BlocksetGrants = RoomGrants<BlocksetAction, BlocksetCapability>;

export const BLOCKSET_CAPABILITY_TABLE = new CapabilityTable(
  BLOCKSET_CAPABILITIES
);
