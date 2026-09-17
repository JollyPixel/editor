// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { FolderHookEvent } from "../features/folders/hooks.ts";

export interface FolderNodeJSON {
  uuid: string;
  name: string;
  parentId: string | null;
}

export interface FolderPlacementJSON {
  blockUuid: string;
  folderId: string;
}

export interface FolderSnapshotJSON {
  folders: FolderNodeJSON[];
  placements: FolderPlacementJSON[];
}

export type FolderNetworkCommand = FolderHookEvent & network.NetworkCommandHeader;

export type FolderServerMessage = network.NetworkServerMessage<
  FolderNetworkCommand,
  FolderSnapshotJSON
>;
