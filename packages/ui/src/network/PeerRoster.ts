// Import Third-party Dependencies
import { html } from "lit";
import type {
  Room,
  RoomPeerPresenceEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { LogQueue } from "../feedback/LogQueue.ts";
import type { PresencePeer } from "../peer/PresencePeer.ts";
import {
  groupPeers,
  peerActivityLabel,
  roomPeers
} from "./peerProfile.ts";

export interface PeerRosterOptions {
  room: Room;
  publish: (
    peers: readonly PresencePeer[]
  ) => void;
  log?: LogQueue;
}

export class PeerRoster {
  #room: Room;
  #publishPeers: (
    peers: readonly PresencePeer[]
  ) => void;
  #log: LogQueue | undefined;
  #known = new Map<string, PresencePeer>();
  #people: ReadonlyMap<string, PresencePeer> = new Map();

  #publish = (): ReadonlyMap<string, PresencePeer> => {
    const previous = this.#people;
    const peers = roomPeers(this.#room);
    this.#known = new Map(peers.map((peer) => [peer.clientId, peer]));
    this.#people = groupPeers(peers);
    this.#publishPeers([...this.#people.values()]);

    return previous;
  };

  #onPeerJoined = (): void => {
    const before = this.#publish();
    for (const [key, person] of this.#people) {
      if (!before.has(key)) {
        this.#announce(person, "joined");
      }
    }
  };

  #onPeerLeft = (): void => {
    const before = this.#publish();
    for (const [key, person] of before) {
      if (!this.#people.has(key)) {
        this.#announce(person, "left");
      }
    }
  };

  #onPeerPresence = (
    event: RoomPeerPresenceEvent
  ): void => {
    const known = this.#known.get(event.clientId);
    const presence = this.#room.peers.get(event.clientId)?.presence;
    if (
      known !== undefined &&
      peerActivityLabel(presence) !== known.activity
    ) {
      this.#publish();
    }
  };

  constructor(
    options: PeerRosterOptions
  ) {
    this.#room = options.room;
    this.#publishPeers = options.publish;
    this.#log = options.log;

    this.#room.on("sync", this.#publish);
    this.#room.on("peer-joined", this.#onPeerJoined);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-profile", this.#publish);
    this.#room.on("peer-presence", this.#onPeerPresence);

    this.#publish();
  }

  dispose(): void {
    this.#room.off("sync", this.#publish);
    this.#room.off("peer-joined", this.#onPeerJoined);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-profile", this.#publish);
    this.#room.off("peer-presence", this.#onPeerPresence);

    this.#known.clear();
    this.#people = new Map();
    this.#publishPeers([]);
  }

  #announce(
    person: PresencePeer,
    verb: "joined" | "left"
  ): void {
    this.#log?.push(html`<b style="color: ${person.color}">${
      person.displayName
    }</b> has ${verb}`);
  }
}
