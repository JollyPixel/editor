// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import type * as networkTypes from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

// Import Internal Dependencies
import {
  toPeerMetadata,
  type EditorIdentity
} from "../collaboration/identity.ts";
import { resolveEditorIdentity } from "../collaboration/resolveEditorIdentity.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";
import type {
  FolderNetworkCommand,
  FolderServerMessage
} from "../network/folderTypes.ts";

// CONSTANTS
const kModelRoomName = "voxel-model";
const kTextureRoomName = "voxel-model:texture";
const kFolderRoomName = "voxel-model:folders";

export type EditorModelRoom = networkTypes.Room<
  ModelNetworkCommand,
  ModelServerMessage
>;

export type EditorTextureRoom = networkTypes.Room<
  PixelNetworkCommand,
  PixelServerMessage
>;

export type EditorFolderRoom = networkTypes.Room<
  FolderNetworkCommand,
  FolderServerMessage
>;

/** No per-document asset id yet, so every open editor joins one fixed room. */
export class EditorSession {
  static async open(): Promise<EditorSession> {
    const identity = await resolveEditorIdentity();

    return new EditorSession(identity);
  }

  #client: network.Client;

  readonly identity: EditorIdentity;
  readonly modelRoom: EditorModelRoom;
  readonly textureRoom: EditorTextureRoom;
  readonly folderRoom: EditorFolderRoom;

  constructor(
    identity: EditorIdentity
  ) {
    this.identity = identity;
    this.#client = new network.Client({
      profile: toPeerMetadata(identity)
    });

    this.modelRoom = this.#client.room<ModelNetworkCommand, ModelServerMessage>(
      kModelRoomName
    );
    this.textureRoom = this.#client.room<PixelNetworkCommand, PixelServerMessage>(
      kTextureRoomName
    );
    this.folderRoom = this.#client.room<FolderNetworkCommand, FolderServerMessage>(
      kFolderRoomName
    );
  }

  dispose(): void {
    this.#client.destroy();
  }
}
