// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";
import type { PresencePeer } from "@jolly-pixel/ui";
import { DriveSession } from "@jolly-pixel/ui/network";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { PlaybackMode } from "../player/PlaybackMode.ts";
import type { SoundPlayer } from "../player/SoundPlayer.ts";
import { PlaybackBeacon } from "./PlaybackBeacon.ts";
import { PlaybackMark } from "./PlaybackMark.ts";
import {
  Playheads,
  type PeerPlayhead,
  type PlacedPeer
} from "./Playheads.ts";

// CONSTANTS
const kPlaybackKey = "playback";

export type SoundCollaborationEvents = {
  change: () => void;
  peersChange: (peers: readonly PresencePeer[]) => void;
};

export interface SoundCollaborationOptions {
  room: Room;
  player: SoundPlayer;
}

export class SoundCollaboration {
  readonly session: DriveSession;

  #player: SoundPlayer;
  #events = new Emitter<SoundCollaborationEvents>();
  #playback: PresenceChannel<PlaybackMark | null>;
  #beacon: PlaybackBeacon;
  #unsubscribe: Array<() => void>;

  #onPlayback = (
    change: PresenceChange<PlaybackMark | null>
  ): void => {
    if (change.clientId === this.session.joinedId && change.value !== undefined) {
      this.#mirror(change.value);
    }
    this.#events.emit("change");
  };

  constructor(
    options: SoundCollaborationOptions
  ) {
    const { room, player } = options;
    this.#player = player;
    this.#playback = new PresenceChannel<PlaybackMark | null>(room, {
      key: kPlaybackKey,
      decode: (value) => PlaybackMark.parse(value)
    });
    this.session = new DriveSession({
      room,
      publish: (peers) => {
        this.#events.emit("peersChange", peers);
        this.#events.emit("change");
      },
      onJoinChange: (driverId) => {
        if (driverId === null) {
          this.#beacon.announce();
        }
        else {
          this.#mirror(this.#sharedMark(driverId));
        }
        this.#events.emit("change");
      }
    });
    this.#beacon = new PlaybackBeacon({
      channel: this.#playback,
      player,
      listening: () => this.session.joinedId !== null
    });

    this.#playback.on("change", this.#onPlayback);
    this.#unsubscribe = [
      player.subscribe("sound", () => this.#rejoin()),
      player.subscribe("resumed", () => {
        if (this.session.joinedId === null) {
          this.#beacon.announce();
        }
        else {
          this.#rejoin();
        }
      })
    ];
  }

  get peers(): readonly PresencePeer[] {
    return this.session.peers;
  }

  subscribe<TEvent extends keyof SoundCollaborationEvents>(
    event: TEvent,
    listener: SoundCollaborationEvents[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  play(): void {
    this.session.leave();
    this.#player.play();
  }

  seek(
    position: number
  ): void {
    this.session.leave();
    this.#player.seek(position);
  }

  pause(): void {
    this.session.leave();
    this.#player.pause();
  }

  retune(
    mode: PlaybackMode
  ): void {
    this.session.leave();
    this.#player.retune(mode);
  }

  listenTo(
    clientId: string
  ): void {
    if (this.session.driverId === clientId) {
      this.session.join();

      return;
    }

    const mark = this.#sharedMark(clientId);
    if (mark !== null) {
      this.session.leave();
      this.#mirror(mark);
    }
  }

  playheads(): PeerPlayhead[] {
    const playheads = new Playheads(this.#placed(), this.session.driverId);

    return this.session.stance.kind === "alone" ?
      playheads.anonymous() :
      playheads.named();
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#beacon.dispose();
    this.#playback.off("change", this.#onPlayback);
    this.#playback.destroy();
    this.session.dispose();
    this.#events.removeAllListeners();
  }

  #rejoin(): void {
    const { joinedId } = this.session;
    if (joinedId !== null) {
      this.#mirror(this.#sharedMark(joinedId));
    }
  }

  #mirror(
    mark: PlaybackMark | null
  ): void {
    if (mark === null) {
      this.#player.pause();
    }
    else {
      mark.mirrorInto(this.#player);
    }
  }

  #placed(): PlacedPeer[] {
    const { duration } = this.#player;
    if (duration === null) {
      return [];
    }

    return this.session.peers.flatMap(
      (peer) => this.#place(peer, duration) ?? []
    );
  }

  #place(
    peer: PresencePeer,
    duration: number
  ): PlacedPeer | null {
    if (peer.self === true) {
      const { elapsed } = this.#player;

      return elapsed === null ? null : {
        peer,
        position: elapsed / duration,
        listening: this.session.joinedId !== null
      };
    }

    const mark = this.#sharedMark(peer.clientId);
    const elapsed = mark?.elapsed(this.#player) ?? null;

    return mark === null || elapsed === null ? null : {
      peer,
      position: elapsed / duration,
      listening: mark.listening
    };
  }

  #sharedMark(
    clientId: string
  ): PlaybackMark | null {
    return this.#playback.values.get(clientId) ?? null;
  }
}
