// Import Third-party Dependencies
import type { BlocksetDocumentNetworkCommand } from "@jolly-pixel/asset.voxel-map/client";
import {
  CapabilityTable,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type BlocksetAction = BlocksetDocumentNetworkCommand["action"];

export type BlocksetCapability =
  | "blocks"
  | "materials"
  | "tileSize";

export type BlocksetAccess = Grants<BlocksetCapability>;
export type BlocksetGrants = RoomGrants<BlocksetAction, BlocksetCapability>;

export const BLOCKSET_CAPABILITIES = new CapabilityTable<
  BlocksetAction,
  BlocksetCapability
>({
  "block-defined": "blocks",
  "block-removed": "blocks",
  "block-moved": "blocks",
  "material-group-defined": "materials",
  "material-group-removed": "materials",
  "material-group-renamed": "materials",
  "blend-group-defined": "materials",
  "blend-group-removed": "materials",
  "tile-size-updated": "tileSize"
});
