// Import Third-party Dependencies
import { html } from "lit";
import type * as network from "@jolly-pixel/network";
import type {
  LogQueue,
  PeerIdentity,
  PresencePeer
} from "@jolly-pixel/ui";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  editorState,
  type PresenceStore
} from "../app/state/index.ts";

export interface PeerRosterOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  identity: PeerIdentity;
  presence?: PresenceStore;
  log?: LogQueue;
}

export class PeerRoster {
  #room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  #identity: PeerIdentity;
  #presence: PresenceStore;
  #log: LogQueue;
  #known = new Map<string, PresencePeer>();

  #publish = (): void => {
    const peers = this.#snapshot();
    this.#known = new Map(peers.map((peer) => [peer.clientId, peer]));
    this.#presence.peers = peers;
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
    this.#presence = options.presence ?? editorState.presence;
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

    this.#presence.peers = [];
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
          displayName: readUsername(peer.profile),
          color: peerProfileColor(
            peer.clientId,
            peer.profile
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
