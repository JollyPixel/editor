// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { PresencePeer } from "@jolly-pixel/ui";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

// Import Internal Dependencies
import {
  editorState,
  type ShellStore
} from "../app/state/index.ts";
import {
  peerColor,
  readUsername,
  type EditorIdentity
} from "./identity.ts";

export interface PeerRosterOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  identity: EditorIdentity;
  shell?: ShellStore;
}

export class PeerRoster {
  #room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  #identity: EditorIdentity;
  #shell: ShellStore;

  #publish = (): void => {
    this.#shell.peers = this.#snapshot();
  };

  constructor(
    options: PeerRosterOptions
  ) {
    this.#room = options.room;
    this.#identity = options.identity;
    this.#shell = options.shell ?? editorState.shell;

    this.#room.on("sync", this.#publish);
    this.#room.on("peer-joined", this.#publish);
    this.#room.on("peer-left", this.#publish);

    this.#publish();
  }

  dispose(): void {
    this.#room.off("sync", this.#publish);
    this.#room.off("peer-joined", this.#publish);
    this.#room.off("peer-left", this.#publish);

    this.#shell.peers = [];
  }

  #snapshot(): PresencePeer[] {
    const remote = [...this.#room.peers.values()]
      .map((peer) => {
        return {
          clientId: peer.clientId,
          displayName: readUsername(peer.identity),
          color: peerColor(peer.clientId, peer.identity)
        };
      })
      .sort((a, b) => a.clientId.localeCompare(b.clientId));

    return [
      {
        clientId: this.#identity.peerId,
        displayName: this.#identity.username,
        color: this.#identity.color,
        self: true
      },
      ...remote
    ];
  }
}
