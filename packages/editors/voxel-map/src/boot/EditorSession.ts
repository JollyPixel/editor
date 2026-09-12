// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import type * as networkTypes from "@jolly-pixel/network";
import {
  assetRoomName,
  type AssetId
} from "@jolly-pixel/asset";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

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
  readonly textureRoom: EditorTextureRoom;

  constructor(
    identity: EditorIdentity,
    assets: EditorAssets
  ) {
    this.identity = identity;
    this.assets = assets;
    this.#client = new network.Client({
      profile: toPeerMetadata(identity)
    });

    const worldRoomName = assetRoomName(
      assets.world.kind,
      assets.world.id.value
    );
    this.worldRoom = this.#client.room<VoxelNetworkCommand, VoxelServerMessage>(
      worldRoomName
    );

    const textureRoomName = assetRoomName(
      assets.texture.kind,
      assets.texture.id.value
    );
    this.textureRoom = this.#client.room<PixelNetworkCommand, PixelServerMessage>(
      textureRoomName
    );
  }

  dispose(): void {
    this.#client.destroy();
  }
}
