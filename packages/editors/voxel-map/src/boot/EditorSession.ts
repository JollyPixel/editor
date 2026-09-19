// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import type * as networkTypes from "@jolly-pixel/network";
import {
  AssetRoom,
  type AssetId
} from "@jolly-pixel/asset";
import {
  CatalogClient,
  catalogRoom
} from "@jolly-pixel/asset-server/catalog/client";
import {
  pixelArtRoom,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import {
  promptPeerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  resolveEditorAssets,
  type EditorAssets
} from "./assets/resolveEditorAssets.ts";

// CONSTANTS
const kIdentityPrompt = {
  title: "Join voxel map",
  storageKey: "voxel-map:username"
};

export type EditorWorldRoom = networkTypes.Room<
  VoxelNetworkCommand,
  VoxelServerMessage
>;

export interface EditorSessionOptions {
  world?: AssetId;
}

export class EditorSession {
  static async open(
    options: EditorSessionOptions = {}
  ): Promise<EditorSession> {
    const identity = await promptPeerIdentity(kIdentityPrompt);
    const assets = await resolveEditorAssets(options);

    return new EditorSession(
      identity,
      assets
    );
  }

  #client: network.Client;

  readonly identity: PeerIdentity;
  readonly assets: EditorAssets;
  readonly worldRoom: EditorWorldRoom;
  readonly catalog: CatalogClient;

  constructor(
    identity: PeerIdentity,
    assets: EditorAssets
  ) {
    this.identity = identity;
    this.assets = assets;
    this.#client = new network.Client({
      profile: toPeerMetadata(identity)
    });

    const worldRoomName = new AssetRoom(
      assets.world.kind,
      assets.world.id
    ).toString();
    this.worldRoom = this.#client.room<VoxelNetworkCommand, VoxelServerMessage>(
      worldRoomName
    );
    this.catalog = new CatalogClient(
      catalogRoom(this.#client)
    );
  }

  textureRoom(
    assetId: string
  ): PixelArtRoom {
    return pixelArtRoom(this.#client, assetId);
  }

  dispose(): void {
    this.catalog.dispose();
    this.#client.destroy();
  }
}
