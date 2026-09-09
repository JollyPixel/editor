// Import Third-party Dependencies
import { html } from "lit";
import type * as network from "@jolly-pixel/network";
import type {
  LogQueue,
  PresencePeer
} from "@jolly-pixel/ui";
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
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  identity: EditorIdentity;
  shell?: ShellStore;
  log?: LogQueue;
}

export class PeerRoster {
  #room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  #identity: EditorIdentity;
  #shell: ShellStore;
  #log: LogQueue;
  #known = new Map<string, PresencePeer>();

  #publish = (): void => {
    const peers = this.#snapshot();
    this.#known = new Map(peers.map((peer) => [peer.clientId, peer]));
    this.#shell.peers = peers;
  };

  #onPeerJoined = (
    event: network.RoomPeerEvent
  ): void => {
    this.#publish();
    this.#announce(event.clientId, "joined");
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    this.#announce(event.clientId, "left");
    this.#publish();
  };

  constructor(
    options: PeerRosterOptions
  ) {
    this.#room = options.room;
    this.#identity = options.identity;
    this.#shell = options.shell ?? editorState.shell;
    this.#log = options.log ?? editorState.log;

    this.#room.on("sync", this.#publish);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);

    this.#publish();
  }

  dispose(): void {
    this.#room.off("sync", this.#publish);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);

    this.#shell.peers = [];
    this.#known.clear();
  }

  #announce(
    clientId: string,
    verb: "joined" | "left"
  ): void {
    const peer = this.#known.get(clientId);
    if (peer === undefined || peer.self === true) {
      return;
    }

    this.#log.push(html`<b style="color: ${peer.color}">${
      peer.displayName
    }</b> has ${verb}`);
  }

  #snapshot(): PresencePeer[] {
    const remote = [...this.#room.peers.values()]
      .map((peer) => {
        return {
          clientId: peer.clientId,
          displayName: readUsername(peer.identity),
          color: peerColor(
            peer.clientId,
            peer.identity
          )
        };
      })
      .sort((peerLeft, peerRight) => peerLeft.clientId.localeCompare(peerRight.clientId));

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
