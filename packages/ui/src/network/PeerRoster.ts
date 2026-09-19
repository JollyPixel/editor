// Import Third-party Dependencies
import { html } from "lit";
import type {
  Room,
  RoomPeerEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { LogQueue } from "../feedback/LogQueue.ts";
import type { PeerIdentity } from "../peer/identity.ts";
import type { PresencePeer } from "../peer/Presence.ts";
import {
  peerProfileColor,
  readUsername
} from "./peerProfile.ts";

export interface PeerRosterOptions {
  room: Room;
  identity: PeerIdentity;
  publish: (
    peers: readonly PresencePeer[]
  ) => void;
  log?: LogQueue;
}

export class PeerRoster {
  #room: Room;
  #identity: PeerIdentity;
  #publishPeers: (
    peers: readonly PresencePeer[]
  ) => void;
  #log: LogQueue | undefined;
  #known = new Map<string, PresencePeer>();

  #publish = (): void => {
    const peers = this.#snapshot();
    this.#known = new Map(peers.map((peer) => [peer.clientId, peer]));
    this.#publishPeers(peers);
  };

  #onPeerJoined = (
    event: RoomPeerEvent
  ): void => {
    this.#publish();
    this.#announce(event.clientId, "joined");
  };

  #onPeerLeft = (
    event: RoomPeerEvent
  ): void => {
    this.#announce(event.clientId, "left");
    this.#publish();
  };

  constructor(
    options: PeerRosterOptions
  ) {
    this.#room = options.room;
    this.#identity = options.identity;
    this.#publishPeers = options.publish;
    this.#log = options.log;

    this.#room.on("sync", this.#publish);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);

    this.#publish();
  }

  dispose(): void {
    this.#room.off("sync", this.#publish);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);

    this.#known.clear();
    this.#publishPeers([]);
  }

  #announce(
    clientId: string,
    verb: "joined" | "left"
  ): void {
    const peer = this.#known.get(clientId);
    if (this.#log === undefined || peer === undefined || peer.self === true) {
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
      .sort((left, right) => left.clientId.localeCompare(right.clientId));

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
