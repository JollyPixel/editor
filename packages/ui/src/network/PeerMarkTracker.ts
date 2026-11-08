// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceDecoder,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PeerMarks } from "../peer/PeerMarks.ts";
import { markedPeers } from "./peerProfile.ts";

export interface PeerMarkLocal<TKey> {
  read(): TKey | null;
  subscribe(
    listener: () => void
  ): () => void;
}

export interface PeerMarkTrackerOptions<TKey> {
  room: Room;
  presenceKey: string;
  decode: PresenceDecoder<TKey>;
  local: PeerMarkLocal<TKey>;
  publish: (
    marks: PeerMarks<TKey>
  ) => void;
}

export class PeerMarkTracker<TKey> {
  #room: Room;
  #channel: PresenceChannel<TKey | null>;
  #local: PeerMarkLocal<TKey>;
  #unsubscribeLocal: () => void;
  #publishMarks: (
    marks: PeerMarks<TKey>
  ) => void;

  #publish = (): void => {
    this.#publishMarks(
      new PeerMarks(markedPeers(this.#room, this.#channel.values))
    );
  };

  #publishLocal = (): void => {
    this.#channel.publish(this.#local.read());
  };

  constructor(
    options: PeerMarkTrackerOptions<TKey>
  ) {
    this.#room = options.room;
    this.#local = options.local;
    this.#publishMarks = options.publish;
    this.#channel = new PresenceChannel<TKey | null>(options.room, {
      key: options.presenceKey,
      decode: options.decode
    });

    this.#channel.on("change", this.#publish);
    this.#room.on("peer-profile", this.#publish);
    this.#unsubscribeLocal = this.#local.subscribe(this.#publishLocal);
    this.#publishLocal();
    this.#publish();
  }

  dispose(): void {
    this.#unsubscribeLocal();
    this.#room.off("peer-profile", this.#publish);
    this.#channel.off("change", this.#publish);
    this.#channel.destroy();
    this.#publishMarks(new PeerMarks());
  }
}
