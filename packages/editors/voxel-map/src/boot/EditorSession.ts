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
  PIXEL_ART_KIND,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";

// Import Internal Dependencies
import {
  toPeerMetadata,
  type EditorIdentity
} from "../collaboration/identity.ts";
import { resolveEditorIdentity } from "../collaboration/resolveEditorIdentity.ts";
import {
  resolveEditorAssets,
  type EditorAssets
} from "./assets/resolveEditorAssets.ts";

export type EditorWorldRoom = networkTypes.Room<
  VoxelNetworkCommand,
  VoxelServerMessage
>;
export type EditorTextureRoom = networkTypes.Room<
  PixelNetworkCommand,
  PixelServerMessage
>;

export interface EditorSessionOptions {
  world?: AssetId;
}

export class EditorSession {
  static async open(
    options: EditorSessionOptions = {}
  ): Promise<EditorSession> {
    const identity = await resolveEditorIdentity();
    const assets = await resolveEditorAssets(options);

    return new EditorSession(identity, assets);
  }

  #client: network.Client;

  readonly identity: EditorIdentity;
  readonly assets: EditorAssets;
  readonly worldRoom: EditorWorldRoom;
  readonly catalog: CatalogClient;

  constructor(
    identity: EditorIdentity,
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
    this.catalog = new CatalogClient(catalogRoom(this.#client));
  }

  textureRoom(
    assetId: string
  ): EditorTextureRoom {
    return this.#client.room<PixelNetworkCommand, PixelServerMessage>(
      new AssetRoom(PIXEL_ART_KIND, assetId).toString()
    );
  }

  dispose(): void {
    this.catalog.dispose();
    this.#client.destroy();
  }
}
